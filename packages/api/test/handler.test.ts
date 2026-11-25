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
