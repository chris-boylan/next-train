import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import {
  buildJourney,
  DART_STATIONS,
  FavouriteError,
  type FavouritesService,
  type FeedbackService,
  findStationByCode,
  getDepartures,
  getLiveTrains,
  isLiveService,
  LIVE_SERVICES,
  type IrishRailClient,
  isServiceId,
  parseDirection,
  SERVICES,
} from '@dart-times/core';

export interface ApiDeps {
  client: IrishRailClient;
  favourites: FavouritesService;
  feedback: FeedbackService;
}

type Result = APIGatewayProxyStructuredResultV2;

const DEVICE_ID = /^[A-Za-z0-9-]{8,64}$/;

function json(statusCode: number, body: unknown, cacheControl = 'no-store'): Result {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': cacheControl },
    body: JSON.stringify(body),
  };
}

/** Live times are shared by everyone, so CloudFront may serve them for 20 s (the Irish Rail client caches for 30 s). */
const DEPARTURES_CACHE = 'public, max-age=20';

/** The request's JSON body as an object, or undefined if it isn't one (or is unreasonably large). */
function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> | undefined {
  if (!event.body || event.body.length > 20_000) return undefined;
  try {
    const value: unknown = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

const error = (statusCode: number, message: string) => json(statusCode, { error: message });

/** Favourites are keyed per browser; the prefix keeps them apart from Alexa users in the shared table. */
function webUserId(event: APIGatewayProxyEventV2): string | undefined {
  const id = event.headers['x-device-id'];
  return id && DEVICE_ID.test(id) ? `web:${id}` : undefined;
}

export function createHandler({ client, favourites, feedback }: ApiDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<Result> => {
    const method = event.requestContext.http.method;
    const path = event.rawPath.replace(/\/+$/, '');

    try {
      if (method === 'GET' && path === '/api/stations') {
        return json(200, DART_STATIONS, 'public, max-age=86400');
      }

      const departuresMatch = path.match(/^\/api\/stations\/([A-Za-z]+)\/departures$/);
      if (method === 'GET' && departuresMatch) {
        const service = event.queryStringParameters?.service ?? 'dart';
        // "all": every train at any Irish Rail station, for the network map's station boards.
        if (service === 'all') {
          const code = departuresMatch[1]!.toUpperCase();
          const departures = await getDepartures(client, code, { includeTrains: true });
          const station = findStationByCode(code) ?? { code };
          return json(200, { station, direction: null, departures, fetchedAt: new Date().toISOString() }, DEPARTURES_CACHE);
        }
        if (!isServiceId(service)) return error(400, 'Unknown service');
        const station = findStationByCode(departuresMatch[1]!, SERVICES[service].stations);
        if (!station) return error(404, 'Unknown station');
        const direction = parseDirection(event.queryStringParameters?.direction);
        const limit = Number(event.queryStringParameters?.limit) || undefined;
        const departures = await getDepartures(client, station.code, { direction, limit, service });
        return json(200, { station, direction: direction ?? null, departures, fetchedAt: new Date().toISOString() }, DEPARTURES_CACHE);
      }

      if (path === '/api/feedback') {
        if (method !== 'POST') return error(405, 'Method not allowed');
        const deviceId = event.headers['x-device-id'];
        if (!deviceId || !DEVICE_ID.test(deviceId)) return error(400, 'Missing or invalid x-device-id header');
        const input = parseBody(event);
        if (!input) return error(400, 'Expected a JSON body');
        const result = await feedback.submit(deviceId, input, { userAgent: event.headers['user-agent'] });
        if (result.ok) return json(200, { ok: true });
        return error(result.reason === 'RATE_LIMITED' ? 429 : 400, result.message);
      }

      // One train's journey from a station to its terminus, for the station page's look-ahead view.
      const journeyMatch = path.match(/^\/api\/trains\/([A-Za-z0-9]{1,8})\/journey$/);
      if (method === 'GET' && journeyMatch) {
        const from = event.queryStringParameters?.from?.toUpperCase();
        if (!from || !/^[A-Z]{2,6}$/.test(from)) return error(400, 'Missing or invalid ?from= station code');
        const journey = buildJourney(await client.getTrainMovements(journeyMatch[1]!), from, Date.now());
        if (!journey) return error(404, 'That train does not call at that station today');
        return json(200, journey, DEPARTURES_CACHE);
      }

      // Where every train on a service is right now, for the live map (DART, Enterprise, Dublin Commuter and InterCity so far).
      if (method === 'GET' && path === '/api/trains') {
        const service = event.queryStringParameters?.service ?? 'dart';
        if (!isLiveService(service)) return error(400, `Live trains are only available for: ${LIVE_SERVICES.join(', ')}`);
        const trains = await getLiveTrains(client, service);
        return json(200, { service, trains, fetchedAt: new Date().toISOString() }, DEPARTURES_CACHE);
      }

      const favouriteMatch = path.match(/^\/api\/favourites(?:\/([A-Za-z]+))?$/);
      if (favouriteMatch) {
        const userId = webUserId(event);
        if (!userId) return error(400, 'Missing or invalid x-device-id header');
        const code = favouriteMatch[1];

        if (method === 'GET' && !code) return json(200, await favourites.list(userId));
        if (method === 'PUT' && code) {
          await favourites.add(userId, code);
          return json(200, await favourites.list(userId));
        }
        if (method === 'DELETE' && code) {
          await favourites.remove(userId, code);
          return json(200, await favourites.list(userId));
        }
        return error(405, 'Method not allowed');
      }

      return error(404, 'Not found');
    } catch (err) {
      if (err instanceof FavouriteError) return error(err.reason === 'UNKNOWN_STATION' ? 404 : 409, err.message);
      console.error(err);
      return error(502, 'Could not get train times from Irish Rail');
    }
  };
}
