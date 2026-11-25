import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import {
  DART_STATIONS,
  FavouriteError,
  type FavouritesService,
  findStationByCode,
  getDepartures,
  type IrishRailClient,
  isServiceId,
  parseDirection,
  SERVICES,
} from '@dart-times/core';

export interface ApiDeps {
  client: IrishRailClient;
  favourites: FavouritesService;
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

const error = (statusCode: number, message: string) => json(statusCode, { error: message });

/** Favourites are keyed per browser; the prefix keeps them apart from Alexa users in the shared table. */
function webUserId(event: APIGatewayProxyEventV2): string | undefined {
  const id = event.headers['x-device-id'];
  return id && DEVICE_ID.test(id) ? `web:${id}` : undefined;
}

export function createHandler({ client, favourites }: ApiDeps) {
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
        if (!isServiceId(service)) return error(400, 'Unknown service');
        const station = findStationByCode(departuresMatch[1]!, SERVICES[service].stations);
        if (!station) return error(404, 'Unknown station');
        const direction = parseDirection(event.queryStringParameters?.direction);
        const limit = Number(event.queryStringParameters?.limit) || undefined;
        const departures = await getDepartures(client, station.code, { direction, limit, service });
        return json(200, { station, direction: direction ?? null, departures, fetchedAt: new Date().toISOString() });
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
