import { describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ALL_STATIONS, type FeedbackEntry, FavouritesService, FeedbackService, InMemoryFavouritesRepository, InMemoryFeedbackRepository, LuasClient } from '@dart-times/core';
import { fixture, fixtureClient } from '../../core/test/fixtures';
import { createHandler } from '../src/handler';

const feedbackRepo = new InMemoryFeedbackRepository();
const emailed: FeedbackEntry[] = [];
const handler = createHandler({
  client: fixtureClient('connolly-midday.xml'),
  // Westmoreland and Jervis (a Red stop, recorded during a disruption) as recorded; any other stop answers as Ranelagh.
  luas: new LuasClient({
    fetch: async (url) => {
      const stop = new URL(String(url)).searchParams.get('stop');
      return new Response(fixture(stop === 'WES' ? 'luas/forecast-wes.xml' : stop === 'JER' ? 'luas/forecast-jer.xml' : 'luas/forecast-ran.xml'));
    },
  }),
  favourites: new FavouritesService(new InMemoryFavouritesRepository()),
  feedback: new FeedbackService(feedbackRepo, { notify: async (e) => void emailed.push(e) }),
});

function request(method: string, path: string, headers: Record<string, string> = {}, body?: string) {
  const url = new URL(path, 'http://x');
  return handler({
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers,
    requestContext: { http: { method } },
    body,
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

  it('returns Luas trams from the Luas feed, with any track no tram stops on', async () => {
    const res = await request('GET', '/api/stations/LU_RAN/departures?service=luas');
    expect(res.statusCode).toBe(200);
    const data = body(res);
    expect(data.station.code).toBe('LU_RAN');
    expect(data.departures.length).toBeGreaterThan(0);
    expect(data.departures.every((d: { category: string }) => d.category === 'luas')).toBe(true);
    expect(data.luas).toMatchObject({ disrupted: false, noService: [] });
    expect(res.headers?.['cache-control']).toBe('public, max-age=20');
    const westmoreland = body(await request('GET', '/api/stations/LU_WES/departures?service=luas'));
    expect(westmoreland.luas.noService).toEqual(['Southbound']);
  });

  it("gives each Luas line's status, for the map's news ticker", async () => {
    const res = await request('GET', '/api/luas/status');
    expect(res.statusCode).toBe(200);
    expect(body(res).lines).toEqual({
      red: { message: 'No service Red Cow – Tallaght / Saggart. See news.', disrupted: true },
      green: { message: 'Green Line services operating normally', disrupted: false },
    });
  });

  it('keeps Luas stops on the Luas, and Luas favourites by their LU_ code', async () => {
    expect((await request('GET', '/api/stations/LU_RAN/departures?service=dart')).statusCode).toBe(404);
    // As deployed: favourites for any station (index.ts), so the code's underscore must get through the route.
    const everywhere = createHandler({
      client: fixtureClient('connolly-midday.xml'),
      favourites: new FavouritesService(new InMemoryFavouritesRepository(), ALL_STATIONS),
      feedback: new FeedbackService(new InMemoryFeedbackRepository(), { notify: async () => {} }),
    });
    const res = await everywhere({
      rawPath: '/api/favourites/LU_RAN',
      queryStringParameters: {},
      headers: device,
      requestContext: { http: { method: 'PUT' } },
    } as unknown as APIGatewayProxyEventV2);
    expect(res.statusCode).toBe(200);
    expect(body(res).map((s: { code: string }) => s.code)).toEqual(['LU_RAN']);
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
    expect((await request('GET', '/api/stations/CNLLY/departures?service=bus')).statusCode).toBe(400);
    expect((await request('GET', '/api/stations/CNLLY/departures?service=luas')).statusCode).toBe(404);
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

describe('API handler: Intercity', () => {
  it('returns only InterCity trains for ?service=intercity', async () => {
    const res = await request('GET', '/api/stations/CNLLY/departures?service=intercity');
    expect(res.statusCode).toBe(200);
    const departures = body(res).departures as { category: string }[];
    expect(departures.length).toBeGreaterThan(0);
    expect(departures.every((d) => d.category === 'intercity')).toBe(true);
  });

  it('accepts Intercity-only stations and rejects ones off the network', async () => {
    expect((await request('GET', '/api/stations/GALWY/departures?service=intercity')).statusCode).toBe(200);
    expect((await request('GET', '/api/stations/HOWTH/departures?service=intercity')).statusCode).toBe(404);
  });
});

describe('API handler: feedback', () => {
  const send = (body: unknown, headers: Record<string, string> = { 'x-device-id': 'feedback-device-1', 'user-agent': 'Safari' }) =>
    request('POST', '/api/feedback', headers, typeof body === 'string' ? body : JSON.stringify(body));

  it('saves and emails a message', async () => {
    const res = await send({ message: 'Love the app', email: 'me@example.ie', elapsedMs: 9000, lang: 'en' });
    expect(res.statusCode).toBe(200);
    expect(body(res)).toEqual({ ok: true });
    expect(res.headers?.['cache-control']).toBe('no-store');
    expect(feedbackRepo.entries.at(-1)).toMatchObject({ deviceId: 'feedback-device-1', message: 'Love the app', email: 'me@example.ie', userAgent: 'Safari' });
    expect(emailed.at(-1)?.message).toBe('Love the app');
  });

  it('rejects bad requests', async () => {
    expect((await send({ message: 'hi', email: 'me@example.ie', elapsedMs: 9000 })).statusCode).toBe(400);
    expect((await send({ message: 'No email given', elapsedMs: 9000 })).statusCode).toBe(400);
    expect((await send('not json')).statusCode).toBe(400);
    expect((await send({ message: 'Hello there', email: 'me@example.ie', elapsedMs: 9000 }, {})).statusCode).toBe(400);
    expect((await request('GET', '/api/feedback', device)).statusCode).toBe(405);
  });

  it('answers 429 once a device has sent too many', async () => {
    const headers = { 'x-device-id': 'feedback-device-busy' };
    for (let i = 0; i < 3; i++) expect((await send({ message: `Message ${i}`, email: 'me@example.ie', elapsedMs: 9000 }, headers)).statusCode).toBe(200);
    expect((await send({ message: 'One more', email: 'me@example.ie', elapsedMs: 9000 }, headers)).statusCode).toBe(429);
  });
});

describe('API handler: train journey', () => {
  const journeyHandler = createHandler({
    client: fixtureClient('movements-E117.xml'),
    favourites: new FavouritesService(new InMemoryFavouritesRepository()),
    feedback: new FeedbackService(new InMemoryFeedbackRepository(), { notify: async () => {} }),
  });
  const get = (path: string) => {
    const url = new URL(path, 'http://x');
    return journeyHandler({
      rawPath: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: {},
      requestContext: { http: { method: 'GET' } },
    } as unknown as APIGatewayProxyEventV2);
  };

  it('returns the stops ahead and where the train is, cacheable briefly', async () => {
    const res = await get('/api/trains/E117/journey?from=bray');
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('public, max-age=20');
    const data = body(res);
    expect(data.destination).toBe('Greystones');
    expect(data.stops.map((s: { code: string }) => s.code)).toEqual(['BRAY', 'GSTNS']);
    expect(data.now).toMatchObject({ kind: 'at', code: 'WBROK' });
  });

  it('rejects a missing station and 404s when the train does not call there', async () => {
    expect((await get('/api/trains/E117/journey')).statusCode).toBe(400);
    expect((await get('/api/trains/E117/journey?from=MHIDE')).statusCode).toBe(404);
  });
});

describe('API handler: live trains', () => {
  const trainsHandler = createHandler({
    client: fixtureClient('current-darts.xml'),
    favourites: new FavouritesService(new InMemoryFavouritesRepository()),
    feedback: new FeedbackService(new InMemoryFeedbackRepository(), { notify: async () => {} }),
  });
  const get = (path: string) => {
    const url = new URL(path, 'http://x');
    return trainsHandler({
      rawPath: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: {},
      requestContext: { http: { method: 'GET' } },
    } as unknown as APIGatewayProxyEventV2);
  };

  it('returns running DARTs placed on the line, cached briefly', async () => {
    const res = await get('/api/trains?service=dart');
    expect(res.statusCode).toBe(200);
    expect(res.headers?.['cache-control']).toBe('public, max-age=20');
    const data = body(res);
    expect(data.service).toBe('dart');
    expect(data.trains).toHaveLength(14);
    expect(data.trains[0]).toHaveProperty('direction');
  });

  it('defaults to the DART and rejects services without live trains yet', async () => {
    expect((await get('/api/trains')).statusCode).toBe(200);
    expect((await get('/api/trains?service=enterprise')).statusCode).toBe(200);
    expect((await get('/api/trains?service=cork')).statusCode).toBe(400);
    expect((await get('/api/trains?service=intercity')).statusCode).toBe(200);
    expect((await get('/api/trains?service=commuter')).statusCode).toBe(200);
  });
});
