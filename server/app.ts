import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';

import type { SessionConfigRequest, SimulationState } from '../src/types/simulation.ts';
import { SimulationEngine, SimulationError } from './engine.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const STATES: SimulationState[] = ['CONFIGURING', 'RUNNING', 'FINISHED'];
const MAX_BODY_BYTES = 64 * 1024;

type Body = Record<string, unknown>;

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new SimulationError(413, 'Anfrage zu groß');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Body;
    }
  } catch {
    // falls through to the validation error below
  }
  throw new SimulationError(422, 'Ungültiger JSON-Body');
}

function requireString(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SimulationError(422, `Feld "${key}" fehlt oder ist leer`);
  }
  return value;
}

function requireNumber(body: Body, key: string): number {
  const value = body[key];
  if (typeof value !== 'number')
    throw new SimulationError(422, `Feld "${key}" muss eine Zahl sein`);
  return value;
}

function parseQuantities(value: unknown, key: string): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SimulationError(422, `Feld "${key}" muss ein Objekt sein`);
  }
  return value as Record<string, number>;
}

function parseConfig(body: Body): SessionConfigRequest {
  if (body.strategy !== undefined && body.strategy !== 'PULL' && body.strategy !== 'PUSH') {
    throw new SimulationError(422, 'Ungültige Strategie');
  }
  return {
    strategy: body.strategy,
    daily_orders: parseQuantities(body.daily_orders, 'daily_orders'),
    daily_production_limits: parseQuantities(
      body.daily_production_limits,
      'daily_production_limits'
    ),
  };
}

type Handler = (engine: SimulationEngine, id: string, body: Body, stationId: number) => unknown;

/** [method, path pattern, handler]; `:id` is the session code, `:station` a station number. */
const ROUTES: [string, RegExp, Handler][] = [
  ['GET', /^\/simulation\/session\/([^/]+)$/, (engine, id) => engine.read(id)],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/state$/,
    (engine, id, body) => {
      const state = body.state as SimulationState;
      if (!STATES.includes(state)) throw new SimulationError(422, 'Ungültiger Status');
      return engine.setState(id, state);
    },
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/config$/,
    (engine, id, body) => engine.configure(id, parseConfig(body)),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/claim$/,
    (engine, id, body) =>
      engine.claim(id, requireString(body, 'student_name'), requireNumber(body, 'station_id')),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/release$/,
    (engine, id, body) => engine.release(id, requireNumber(body, 'station_id')),
  ],
  ['POST', /^\/simulation\/session\/([^/]+)\/reset$/, (engine, id) => engine.reset(id)],
  ['POST', /^\/simulation\/session\/([^/]+)\/next-day$/, (engine, id) => engine.nextDay(id)],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/customer-join$/,
    (engine, id) => engine.customerJoin(id),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/orders\/add$/,
    (engine, id, body) => {
      if (!Array.isArray(body.items))
        throw new SimulationError(422, 'Feld "items" muss eine Liste sein');
      if (!body.items.every((item) => typeof item === 'object' && item !== null)) {
        throw new SimulationError(422, 'Ungültige Position in "items"');
      }
      const name = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
      return engine.addOrder(
        id,
        name || null,
        body.items as { variant: unknown; quantity: unknown }[]
      );
    },
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/([12])\/complete$/,
    (engine, id, _body, stationId) => engine.completeSupply(id, stationId),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/3\/produce-batch$/,
    (engine, id, body) => engine.produceBatch(id, body.variant, requireNumber(body, 'quantity')),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/4\/store-batch$/,
    (engine, id, body) => engine.storeBatch(id, requireString(body, 'batch_id')),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/4\/report-deviation$/,
    (engine, id, body) =>
      engine.reportDeviation(
        id,
        requireString(body, 'batch_id'),
        requireString(body, 'reason'),
        requireNumber(body, 'missing_quantity')
      ),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/5\/retrieve-item$/,
    (engine, id, body) => engine.retrieveItem(id, body.variant, requireNumber(body, 'quantity')),
  ],
  [
    'POST',
    /^\/simulation\/session\/([^/]+)\/stations\/5\/finish-day$/,
    (engine, id) => engine.finishDayFromStation5(id),
  ],
];

async function serveStatic(
  staticDir: string,
  pathname: string,
  method: string,
  response: ServerResponse
) {
  // Resolve inside staticDir only (relative-path check, not a string prefix); unknown paths fall
  // back to the SPA entry so QR deep links work.
  const requested = normalize(join(staticDir, pathname));
  const relation = relative(staticDir, requested);
  const isInside = relation !== '' && !relation.startsWith('..') && !isAbsolute(relation);
  const isFile = isInside && existsSync(requested) && statSync(requested).isFile();
  const file = isFile ? requested : join(staticDir, 'index.html');
  const isHashedAsset = pathname.startsWith('/assets/');

  if (!existsSync(file) || (isHashedAsset && !isFile)) {
    response.writeHead(404).end('Not found');
    return;
  }
  // Read before any header is written so a read error can still become a clean 500.
  const body = await readFile(file);
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  response.end(method === 'HEAD' ? undefined : body);
}

type AppOptions = {
  engine?: SimulationEngine;
  staticDir?: string;
  /** Origins allowed to call the API from another origin (`*` = any). Default: same origin only. */
  corsOrigins?: string[];
};

/** Adds CORS headers for an allowed origin; returns true if the request was an answered preflight. */
function handleCors(
  request: IncomingMessage,
  response: ServerResponse,
  corsOrigins: string[]
): boolean {
  const origin = request.headers.origin;
  if (!origin || corsOrigins.length === 0) return false;
  if (!corsOrigins.includes('*') && !corsOrigins.includes(origin)) return false;

  response.setHeader('Access-Control-Allow-Origin', corsOrigins.includes('*') ? '*' : origin);
  response.setHeader('Vary', 'Origin');
  if (request.method !== 'OPTIONS') return false;

  response.writeHead(204, {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  });
  response.end();
  return true;
}

/** REST API for the simulation (same contract as ADR-SIM-01/02) plus optional static hosting. */
export function createApp({
  engine = new SimulationEngine(),
  staticDir,
  corsOrigins = [],
}: AppOptions = {}): RequestListener {
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const method = request.method ?? 'GET';

    try {
      if (handleCors(request, response, corsOrigins)) return;
      if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok' });

      if (url.pathname === '/simulation/session/create' && method === 'POST') {
        return sendJson(response, 200, engine.create());
      }

      for (const [routeMethod, pattern, handler] of ROUTES) {
        const match = pattern.exec(url.pathname);
        if (!match || routeMethod !== method) continue;
        const body = method === 'POST' ? await readBody(request) : {};
        const sessionId = decodeURIComponent(match[1]);
        return sendJson(response, 200, handler(engine, sessionId, body, Number(match[2])));
      }

      if (url.pathname.startsWith('/simulation/')) {
        return sendJson(response, 404, { detail: 'Unbekannter Endpunkt' });
      }
      if (staticDir && (method === 'GET' || method === 'HEAD')) {
        return await serveStatic(staticDir, url.pathname, method, response);
      }
      sendJson(response, 404, { detail: 'Not found' });
    } catch (error) {
      if (error instanceof SimulationError) {
        return sendJson(response, error.status, { detail: error.message });
      }
      console.error('Unhandled simulation server error:', error);
      sendJson(response, 500, { detail: 'Interner Serverfehler' });
    }
  };
}
