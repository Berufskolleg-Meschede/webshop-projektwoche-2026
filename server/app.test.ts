// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app.ts';

import type { SimulationSession } from '../src/types/simulation.ts';

type Json = SimulationSession & { detail?: string };

let server: Server;
let base: string;

beforeAll(async () => {
  const staticDir = mkdtempSync(join(tmpdir(), 'bkm-static-'));
  mkdirSync(join(staticDir, 'assets'));
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>shop</title>');
  writeFileSync(join(staticDir, 'assets', 'app-1.js'), 'console.log(1)');
  writeFileSync(join(staticDir, 'logo.svg'), '<svg/>');
  writeFileSync(join(staticDir, 'blob.bin'), 'x');
  server = createServer(createApp({ staticDir }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call(method: string, path: string, body?: unknown, raw?: string) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // static files are not JSON
  }
  return {
    status: response.status,
    json: json as Json,
    text,
    headers: response.headers,
  };
}

async function newSession() {
  return (await call('POST', '/simulation/session/create')).json.session_id as string;
}

describe('simulation REST API', () => {
  it('reports health', async () => {
    expect((await call('GET', '/health')).json).toEqual({ status: 'ok' });
  });

  it('creates and reads a session', async () => {
    const id = await newSession();
    const read = await call('GET', `/simulation/session/${id}`);
    expect(read.status).toBe(200);
    expect(read.json).toMatchObject({ session_id: id, state: 'CONFIGURING', customer_count: 0 });
    expect((await call('GET', '/simulation/session/0000')).json).toEqual({
      detail: 'Session nicht gefunden',
    });
  });

  it('keeps the claim contract: holder name in detail on 409', async () => {
    const id = await newSession();
    const claim = (name: string) =>
      call('POST', `/simulation/session/${id}/claim`, { student_name: name, station_id: 3 });
    expect((await claim('Mia')).status).toBe(200);
    const conflict = await claim('Jan');
    expect(conflict).toMatchObject({ status: 409, json: { detail: 'Mia' } });
    await call('POST', `/simulation/session/${id}/release`, { station_id: 3 });
    expect((await claim('Jan')).status).toBe(200);
  });

  it('validates request bodies with 422', async () => {
    const id = await newSession();
    const path = `/simulation/session/${id}`;
    expect((await call('POST', `${path}/claim`, { station_id: 3 })).status).toBe(422);
    expect(
      (await call('POST', `${path}/claim`, { student_name: '  ', station_id: 3 })).status
    ).toBe(422);
    expect(
      (await call('POST', `${path}/claim`, { student_name: 'a', station_id: '3' })).status
    ).toBe(422);
    expect((await call('POST', `${path}/state`, { state: 'NOPE' })).status).toBe(422);
    expect((await call('POST', `${path}/config`, { strategy: 'X' })).status).toBe(422);
    expect((await call('POST', `${path}/config`, { daily_orders: [] })).status).toBe(422);
    expect((await call('POST', `${path}/claim`, undefined, '{nope')).status).toBe(422);
    expect((await call('POST', `${path}/claim`, undefined, '[1]')).status).toBe(422);
    expect((await call('POST', `${path}/claim`, { student_name: 'a', station_id: 9 })).status).toBe(
      400
    );
  });

  it('lets Station 5 end a Push day over HTTP', async () => {
    const id = await newSession();
    const post = (path: string, body?: unknown) =>
      call('POST', `/simulation/session/${id}${path}`, body);
    await post('/config', {
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 2 },
      daily_production_limits: { 'S-RT': 1 },
    });
    await post('/state', { state: 'RUNNING' });
    expect((await post('/stations/5/finish-day')).status).toBe(409);
    await post('/stations/1/complete');
    await post('/stations/2/complete');
    expect((await post('/stations/5/finish-day')).status).toBe(409); // production still open
    await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 1 });
    await post('/stations/4/store-batch', { batch_id: 'b1' });
    const ended = await post('/stations/5/finish-day');
    expect(ended.status).toBe(200);
    expect(ended.json.state).toBe('FINISHED');
    expect(ended.json.shortfall['S-RT']).toBe(2);
  });

  it('rejects oversized bodies', async () => {
    const id = await newSession();
    const huge = JSON.stringify({ student_name: 'x'.repeat(70_000), station_id: 1 });
    expect((await call('POST', `/simulation/session/${id}/claim`, undefined, huge)).status).toBe(
      413
    );
  });

  it('runs a full Pull day over HTTP', async () => {
    const id = await newSession();
    const post = (path: string, body?: unknown) =>
      call('POST', `/simulation/session/${id}${path}`, body);

    expect((await post('/config', { daily_orders: { 'S-RT': 1 } })).status).toBe(200);
    await post('/state', { state: 'RUNNING' });
    expect((await post('/config', { strategy: 'PUSH' })).status).toBe(409);
    await post('/customer-join');
    await post('/stations/1/complete');
    // Pull: the supply opens Station 5 first, production waits for the retrieval (#198)
    const supplied = await post('/stations/2/complete');
    expect(supplied.json.stations[4].status).toBe('ACTIVE');
    expect(supplied.json.stations[2].status).toBe('IDLE');
    expect((await post('/stations/1/complete')).status).toBe(200); // a repeat is a no-op
    expect((await post('/stations/3/complete')).status).toBe(404); // only 1 and 2 are supply routes
    expect((await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 1 })).status).toBe(
      409
    );
    const retrieved = await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 1 });
    expect(retrieved.json.stations[2].status).toBe('ACTIVE');
    expect((await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 9 })).status).toBe(
      422
    );
    await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 1 });
    const done = await post('/stations/4/store-batch', { batch_id: 'b1' });
    expect(done.json).toMatchObject({ state: 'FINISHED', customer_count: 1 });
    expect((await post('/reset')).json.state).toBe('CONFIGURING');
  });

  it('starts the next day over HTTP only after a finished day (#124)', async () => {
    const id = await newSession();
    const post = (path: string, body?: unknown) =>
      call('POST', `/simulation/session/${id}${path}`, body);

    expect((await post('/next-day')).status).toBe(409);
    await post('/config', { daily_orders: { 'S-RT': 1 } });
    await post('/state', { state: 'RUNNING' });
    expect((await post('/next-day')).status).toBe(409);
    await post('/claim', { student_name: 'Mia', station_id: 3 });
    await post('/stations/1/complete');
    await post('/stations/2/complete');
    await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 1 });
    await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 1 });
    await post('/stations/4/store-batch', { batch_id: 'b1' });

    const next = await post('/next-day');
    expect(next.status).toBe(200);
    expect(next.json).toMatchObject({ state: 'CONFIGURING', run_id: 2, batches: [] });
    expect(next.json.stations[2].claimed_by).toBe('Mia');
    expect(next.json.daily_orders['S-RT']).toBe(0);
    expect((await call('POST', '/simulation/session/0000/next-day')).status).toBe(404);
  });

  it('answers a deviation report', async () => {
    const id = await newSession();
    const post = (path: string, body?: unknown) =>
      call('POST', `/simulation/session/${id}${path}`, body);
    await post('/config', { daily_orders: { 'S-RT': 2 } });
    await post('/state', { state: 'RUNNING' });
    await post('/stations/1/complete');
    await post('/stations/2/complete');
    await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 2 });
    await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 2 });
    const report = await post('/stations/4/report-deviation', {
      batch_id: 'b1',
      reason: 'Kratzer',
      missing_quantity: 1,
    });
    expect(report.json.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 1, reason: 'Kratzer' },
    ]);
  });

  it('takes customer orders over HTTP', async () => {
    const id = await newSession();
    const add = (body: unknown) => call('POST', `/simulation/session/${id}/orders/add`, body);
    const ok = await add({ customer_name: ' Mia ', items: [{ variant: 'S-RT', quantity: 2 }] });
    expect(ok.status).toBe(200);
    expect(ok.json.daily_orders['S-RT']).toBe(2);
    expect(ok.json.orders[0]).toMatchObject({ customer_name: 'Mia', items: { 'S-RT': 2 } });
    expect(
      (await add({ items: [{ variant: 'S-SI', quantity: 1 }] })).json.orders[1].customer_name
    ).toBeNull();
    expect((await add({})).status).toBe(422);
    expect((await add({ items: [null] })).status).toBe(422);
    expect((await add({ items: [{ variant: 'X', quantity: 1 }] })).status).toBe(422);
    await call('POST', `/simulation/session/${id}/state`, { state: 'RUNNING' });
    expect((await add({ items: [{ variant: 'S-RT', quantity: 1 }] })).status).toBe(409);
  });

  it('answers unknown simulation endpoints with 404 and handles methods', async () => {
    expect((await call('GET', '/simulation/unknown')).status).toBe(404);
    expect((await call('GET', '/simulation/session/1234/claim')).status).toBe(404);
    expect((await call('DELETE', '/other')).status).toBe(404);
  });
});

describe('CORS (review R3)', () => {
  let cors: Server;
  let corsBase: string;

  beforeAll(async () => {
    cors = createServer(createApp({ corsOrigins: ['http://localhost:5173'] }));
    await new Promise<void>((resolve) => cors.listen(0, '127.0.0.1', resolve));
    corsBase = `http://127.0.0.1:${(cors.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => cors.close(() => resolve())));

  it('answers the preflight for an allowed origin', async () => {
    const response = await fetch(`${corsBase}/simulation/session/create`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
  });

  it('adds the header to success and error responses, and not for other origins', async () => {
    const ok = await fetch(`${corsBase}/health`, { headers: { Origin: 'http://localhost:5173' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const missing = await fetch(`${corsBase}/simulation/session/0000`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const other = await fetch(`${corsBase}/health`, { headers: { Origin: 'http://evil.test' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows any origin with * and stays closed by default', async () => {
    const open = createServer(createApp({ corsOrigins: ['*'] }));
    await new Promise<void>((resolve) => open.listen(0, '127.0.0.1', resolve));
    const port = (open.address() as AddressInfo).port;
    const wildcard = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Origin: 'http://x.test' },
    });
    expect(wildcard.headers.get('access-control-allow-origin')).toBe('*');
    await new Promise<void>((resolve) => open.close(() => resolve()));

    const sameOriginOnly = await fetch(`${base}/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(sameOriginOnly.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('static hosting', () => {
  it('serves files with cache headers and an SPA fallback', async () => {
    const index = await call('GET', '/');
    expect(index.text).toContain('<title>shop</title>');
    expect(index.headers.get('cache-control')).toBe('no-cache');

    const asset = await call('GET', '/assets/app-1.js');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(asset.headers.get('content-type')).toContain('javascript');

    expect((await call('GET', '/logo.svg')).headers.get('content-type')).toBe('image/svg+xml');
    expect((await call('GET', '/blob.bin')).headers.get('content-type')).toBe(
      'application/octet-stream'
    );
    expect((await call('GET', '/?session=4827&role=customer')).text).toContain(
      '<title>shop</title>'
    );
    expect((await call('GET', '/some/deep/link')).text).toContain('<title>shop</title>');
  });

  it('answers HEAD like GET without a body', async () => {
    const response = await fetch(`${base}/`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(Number(response.headers.get('content-length'))).toBeGreaterThan(0);
    expect(await response.text()).toBe('');
  });

  it('does not fall back for missing hashed assets and blocks path traversal', async () => {
    expect((await call('GET', '/assets/missing.js')).status).toBe(404);
    const traversal = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`);
    expect(await traversal.text()).toContain('<title>shop</title>');
  });
});

describe('without a static directory', () => {
  it('answers 404 for non-API paths', async () => {
    const bare = createServer(createApp());
    await new Promise<void>((resolve) => bare.listen(0, '127.0.0.1', resolve));
    const port = (bare.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(404);
    await new Promise<void>((resolve) => bare.close(() => resolve()));
  });
});
