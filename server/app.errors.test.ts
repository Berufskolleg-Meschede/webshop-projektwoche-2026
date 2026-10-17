// @vitest-environment node
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.ts';
import { SimulationEngine } from './engine.ts';

let server: Server;

async function start(engine: SimulationEngine) {
  server = createServer(createApp({ engine }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('unexpected engine failures', () => {
  it('answer 500 with a generic detail and do not leak the internal error', async () => {
    const engine = new SimulationEngine();
    vi.spyOn(engine, 'create').mockImplementation(() => {
      throw new Error('secret internal path');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = await start(engine);

    const response = await fetch(`${base}/simulation/session/create`, { method: 'POST' });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toEqual({ detail: expect.any(String) });
    expect(logged).toHaveBeenCalled();
  });

  it('keep the server alive for the next request after a 500', async () => {
    const engine = new SimulationEngine();
    vi.spyOn(engine, 'create').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = await start(engine);

    const failed = await fetch(`${base}/simulation/session/create`, { method: 'POST' });
    const retried = await fetch(`${base}/simulation/session/create`, { method: 'POST' });

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(200);
  });
});
