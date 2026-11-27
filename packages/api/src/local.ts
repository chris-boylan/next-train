// Local development server: runs the Lambda handler on http://localhost:3001 with in-memory favourites and
// feedback (messages are printed here instead of emailed).
import { createServer } from 'node:http';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  ALL_STATIONS,
  ConsoleFeedbackNotifier,
  FavouritesService,
  FeedbackService,
  InMemoryFavouritesRepository,
  InMemoryFeedbackRepository,
  IrishRailClient,
} from '@dart-times/core';
import { createHandler } from './handler';
import { GtfsTimetable } from './timetable';

const port = Number(process.env.PORT ?? 3001);
const handler = createHandler({
  client: new IrishRailClient(),
  favourites: new FavouritesService(new InMemoryFavouritesRepository(), ALL_STATIONS),
  feedback: new FeedbackService(new InMemoryFeedbackRepository(), new ConsoleFeedbackNotifier()),
  scheduled: new GtfsTimetable(),
});

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const event = {
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams),
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
    requestContext: { http: { method: req.method ?? 'GET' } },
    body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined,
  } as unknown as APIGatewayProxyEventV2;

  const result = await handler(event);
  res.writeHead(result.statusCode ?? 200, result.headers as Record<string, string>);
  res.end(result.body);
  console.log(`${req.method} ${url.pathname}${url.search} -> ${result.statusCode}`);
}).listen(port, () => console.log(`API listening on http://localhost:${port}`));
