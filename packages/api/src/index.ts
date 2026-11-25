// Lambda entry point (deployed behind API Gateway HTTP API + CloudFront at /api/*).
import { FavouritesService, IrishRailClient } from '@dart-times/core';
import { DynamoFavouritesRepository } from '@dart-times/core/dynamo';
import { createHandler } from './handler';

const tableName = process.env.FAVOURITES_TABLE;
if (!tableName) throw new Error('FAVOURITES_TABLE is not set');

// Created once per Lambda container, so the client's cache is shared between invocations.
export const handler = createHandler({
  client: new IrishRailClient(),
  favourites: new FavouritesService(new DynamoFavouritesRepository(tableName)),
});
