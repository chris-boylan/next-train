// Local development server: runs the Lambda handler on http://localhost:3001 with in-memory favourites.
import { createServer } from 'node:http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ALL_STATIONS, FavouritesService, InMemoryFavouritesRepository, IrishRailClient } from '@dart-times/core';
import { createHandler } from './handler';

const port = Number(process.env.PORT ?? 3001);
const handler = createHandler({
  client: new IrishRailClient(),
  favourites: new FavouritesService(new InMemoryFavouritesRepository(), ALL_STATIONS),
});

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const event = {
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
    requestContext: { http: { method: req.method ?? 'GET' } },
  } as unknown as APIGatewayProxyEventV2;

  const result = await handler(event);
  res.writeHead(result.statusCode ?? 200, result.headers as Record<string, string>);
  res.end(result.body);
  console.log(`${req.method} ${url.pathname}${url.search} -> ${result.statusCode}`);
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
