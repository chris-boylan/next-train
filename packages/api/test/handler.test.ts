import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { FavouritesService, InMemoryFavouritesRepository } from '@dart-times/core';
import { fixtureClient } from '../../core/test/fixtures';
import { createHandler } from '../src/handler';

const handler = createHandler({
  client: fixtureClient('connolly-midday.xml'),
  favourites: new FavouritesService(new InMemoryFavouritesRepository()),
});

function request(method: string, path: string, headers: Record<string, string> = {}) {
  const url = new URL(path, 'http://x');
  return handler({
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers,
    requestContext: { http: { method } },
  } as unknown as APIGatewayProxyEventV2);
}

const body = (r: { body?: string }) => JSON.parse(r.body ?? 'null');
const device = { 'x-device-id': 'test-device-123' };

describe('API handler', () => {
  it('lists stations', async () => {
    const res = await request('GET', '/api/stations');
    expect(res.statusCode).toBe(200);
    expect(body(res)).toHaveLength(32);
  });

  it('returns filtered departures', async () => {
    const res = await request('GET', '/api/stations/cnlly/departures?direction=south&limit=2');
    expect(res.statusCode).toBe(200);
    const data = body(res);
    expect(data.station.code).toBe('CNLLY');
    expect(data.direction).toBe('Southbound');
    expect(data.departures).toHaveLength(2);
    expect(data.departures.every((d: { direction: string }) => d.direction === 'Southbound')).toBe(true);
  });

  it('lets the edge cache departures briefly, but never favourites or errors', async () => {
    const departures = await request('GET', '/api/stations/CNLLY/departures');
    expect(departures.headers?.['cache-control']).toBe('public, max-age=20');
    const all = await request('GET', '/api/stations/CNLLY/departures?service=all');
    expect(all.headers?.['cache-control']).toBe('public, max-age=20');
    expect((await request('GET', '/api/stations/NOPE/departures')).headers?.['cache-control']).toBe('no-store');
    expect((await request('GET', '/api/favourites', device)).headers?.['cache-control']).toBe('no-store');
  });

  it('404s on unknown stations', async () => {
    expect((await request('GET', '/api/stations/NOPE/departures')).statusCode).toBe(404);
  });

  it('manages favourites per device', async () => {
    expect((await request('GET', '/api/favourites')).statusCode).toBe(400);
    await request('PUT', '/api/favourites/PERSE', device);
    const res = await request('PUT', '/api/favourites/CNLLY', device);
    expect(body(res).map((s: { code: string }) => s.code)).toEqual(['PERSE', 'CNLLY']);
    const after = await request('DELETE', '/api/favourites/PERSE', device);
    expect(body(after).map((s: { code: string }) => s.code)).toEqual(['CNLLY']);
    expect(body(await request('GET', '/api/favourites', { 'x-device-id': 'other-device-1' }))).toEqual([]);
  });

  it('rejects unknown favourite stations', async () => {
    expect((await request('PUT', '/api/favourites/NOPE', device)).statusCode).toBe(404);
  });
});

describe('API handler: Enterprise', () => {
  it('returns Belfast trains for ?service=enterprise', async () => {
    const res = await request('GET', '/api/stations/CNLLY/departures?service=enterprise');
    expect(res.statusCode).toBe(200);
    expect(body(res).departures.every((d: { destination: string }) => d.destination === 'Belfast')).toBe(true);
  });

  it('rejects stations not on the service, and unknown services', async () => {
    expect((await request('GET', '/api/stations/HOWTH/departures?service=enterprise')).statusCode).toBe(404);
    expect((await request('GET', '/api/stations/NEWRY/departures')).statusCode).toBe(404);
    expect((await request('GET', '/api/stations/CNLLY/departures?service=luas')).statusCode).toBe(400);
  });
});

describe('API handler: all trains', () => {
  it('returns every train with its category for ?service=all', async () => {
    const res = await request('GET', '/api/stations/CNLLY/departures?service=all');
    expect(res.statusCode).toBe(200);
    const categories = new Set(body(res).departures.map((d: { category: string }) => d.category));
    expect(categories).toEqual(new Set(['dart', 'enterprise', 'intercity', 'commuter']));
  });
});

describe('API handler: Dublin Commuter', () => {
  it('returns only commuter trains for ?service=commuter', async () => {
    const res = await request('GET', '/api/stations/CNLLY/departures?service=commuter');
    expect(res.statusCode).toBe(200);
    const departures = body(res).departures as { category: string }[];
    expect(departures.length).toBeGreaterThan(0);
    expect(departures.every((d) => d.category === 'commuter')).toBe(true);
  });

  it('accepts commuter-only stations and rejects ones off the network', async () => {
    expect((await request('GET', '/api/stations/MYNTH/departures?service=commuter')).statusCode).toBe(200);
    expect((await request('GET', '/api/stations/HOWTH/departures?service=commuter')).statusCode).toBe(404);
  });
});
