// @vitest-environment node
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SimulationSession } from '../src/types/simulation.ts';
import { createApp } from './app.ts';

type Json = SimulationSession & { detail?: string };

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function send(method: string, path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Json };
}

async function newDay() {
  const id = (await send('POST', '/simulation/session/create')).json.session_id;
  const post = (path: string, body?: unknown) =>
    send('POST', `/simulation/session/${id}${path}`, body);
  return { id, post, read: () => send('GET', `/simulation/session/${id}`) };
}

describe('multi-station flows over HTTP', () => {
  it('runs a Pull day with a rejected batch to the end by itself', async () => {
    const { post, read } = await newDay();
    await post('/config', { daily_orders: { 'S-RT': 2 } });
    await post('/state', { state: 'RUNNING' });
    await post('/stations/1/complete');
    await post('/stations/2/complete');
    await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 2 });
    await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 2 });

    const rejected = await post('/stations/4/report-deviation', {
      batch_id: 'b1',
      reason: 'Kratzer',
      missing_quantity: 1,
    });
    expect(rejected.status).toBe(200);
    expect(rejected.json.replenishment_queue).toHaveLength(1);
    expect(rejected.json.stations[2].status).toBe('ACTIVE');

    // storing the rejected batch again is refused, the replenishment closes the loop
    expect((await post('/stations/4/store-batch', { batch_id: 'b1' })).status).toBe(422);
    const replenished = await post('/stations/3/produce-batch', { variant: 'S-RT', quantity: 1 });
    expect(replenished.json.state).toBe('RUNNING');
    const finished = await post('/stations/4/store-batch', { batch_id: 'b3' });
    expect(finished.json.state).toBe('FINISHED');
    expect((await read()).json.stock['S-RT']).toBe(0);
  });

  it('carries the shortfall of a teacher-ended Pull day into the next day over HTTP', async () => {
    const { post } = await newDay();
    await post('/config', { daily_orders: { 'S-RT': 3, 'P-SW': 1 } });
    await post('/state', { state: 'RUNNING' });
    await post('/stations/1/complete');
    await post('/stations/2/complete');
    await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 1 });

    const ended = await post('/state', { state: 'FINISHED' });
    expect(ended.json.shortfall).toMatchObject({ 'S-RT': 2, 'P-SW': 1 });
    expect((await post('/stations/5/retrieve-item', { variant: 'S-RT', quantity: 1 })).status).toBe(
      409
    );

    const next = await post('/next-day');
    expect(next.status).toBe(200);
    expect(next.json.state).toBe('CONFIGURING');
    expect(next.json.daily_orders).toMatchObject({ 'S-RT': 2, 'P-SW': 1 });
    expect(next.json.carried_over).toMatchObject({ 'S-RT': 2, 'P-SW': 1 });
    expect(next.json.orders).toEqual([]);
  });

  it('answers a claim conflict with the holder and accepts a new claim after release', async () => {
    const { post, read } = await newDay();
    await post('/claim', { student_name: 'Mia', station_id: 3 });
    const conflict = await post('/claim', { student_name: 'Jan', station_id: 3 });
    expect(conflict.status).toBe(409);
    expect(conflict.json.detail).toBe('Mia');
    expect((await post('/claim', { student_name: 'Mia', station_id: 3 })).status).toBe(200);

    expect((await post('/release', { station_id: 3 })).status).toBe(200);
    expect((await post('/claim', { student_name: 'Jan', station_id: 3 })).status).toBe(200);
    expect((await read()).json.stations[2].claimed_by).toBe('Jan');
    expect((await post('/release', { station_id: 9 })).status).toBe(400);
  });
});
