// Lambda entry point for the Alexa skill.
import { FavouritesService, IrishRailClient } from '@dart-times/core';
import { DynamoFavouritesRepository } from '@dart-times/core/dynamo';
import { createSkill } from './skill';

const tableName = process.env.FAVOURITES_TABLE;
if (!tableName) throw new Error('FAVOURITES_TABLE is not set');

export const handler = createSkill({
  client: new IrishRailClient(),
  favourites: new FavouritesService(new DynamoFavouritesRepository(tableName)),
  skillId: process.env.ALEXA_SKILL_ID || undefined,
}).lambda();
