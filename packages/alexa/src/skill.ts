import * as Alexa from 'ask-sdk-core';
import type { HandlerInput, RequestHandler } from 'ask-sdk-core';
import {
  type Direction,
  FavouriteError,
  type FavouritesService,
  findStationByCode,
  getDepartures,
  type IrishRailClient,
  parseDirection,
  resolveStation,
  type Station,
} from '@dart-times/core';
import { departuresSpeech, escapeSsml, SPOKEN_DEPARTURES } from './speech';

export interface SkillDeps {
  client: IrishRailClient;
  favourites: FavouritesService;
  /** When set, requests from other skills are rejected. */
  skillId?: string;
}

const ASK_STATION = 'Which station would you like? For example, say: next DART from Connolly.';

/** Favourites are keyed per Alexa user; the prefix keeps them apart from web users in the shared table. */
const userId = (input: HandlerInput) => `alexa:${Alexa.getUserId(input.requestEnvelope)}`;

/** A final answer: speak and end the session (otherwise devices with screens may leave it open). */
const answer = (input: HandlerInput, speech: string) =>
  input.responseBuilder.speak(speech).withShouldEndSession(true).getResponse();

const isIntent = (input: HandlerInput, ...names: string[]) =>
  Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
  names.includes(Alexa.getIntentName(input.requestEnvelope));

/** Slot values carry the station code as their entity ID; fall back to fuzzy matching what was heard. */
function stationFromSlot(input: HandlerInput): Station | undefined {
  const slot = Alexa.getSlot(input.requestEnvelope, 'station');
  if (!slot?.value) return undefined;
  const match = slot.resolutions?.resolutionsPerAuthority?.find((r) => r.status.code === 'ER_SUCCESS_MATCH');
  const id = match?.values?.[0]?.value.id;
  return (id && findStationByCode(id)) || resolveStation(slot.value);
}

function directionFromSlot(input: HandlerInput): Direction | undefined {
  const slot = Alexa.getSlot(input.requestEnvelope, 'direction');
  const match = slot?.resolutions?.resolutionsPerAuthority?.find((r) => r.status.code === 'ER_SUCCESS_MATCH');
  return parseDirection(match?.values?.[0]?.value.id ?? slot?.value);
}

export function createSkill({ client, favourites, skillId }: SkillDeps) {
  const speakDepartures = async (station: Station, direction?: Direction) => {
    const departures = await getDepartures(client, station.code, { direction, limit: SPOKEN_DEPARTURES });
    return departuresSpeech(station, departures, direction);
  };

  const Launch: RequestHandler = {
    canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'LaunchRequest',
    async handle(input) {
      // "Alexa, open DART times" answers straight away for the first favourite.
      const [first] = await favourites.list(userId(input));
      if (first) return answer(input, await speakDepartures(first));
      return input.responseBuilder.speak(`Welcome to DART Times. ${ASK_STATION}`).reprompt(ASK_STATION).getResponse();
    },
  };

  const GetDepartures: RequestHandler = {
    canHandle: (input) => isIntent(input, 'GetDeparturesIntent'),
    async handle(input) {
      const station = stationFromSlot(input);
      if (!station) {
        const heard = Alexa.getSlotValue(input.requestEnvelope, 'station');
        const prefix = heard ? `Sorry, I don't know a DART station called ${escapeSsml(heard)}. ` : '';
        return input.responseBuilder.speak(prefix + ASK_STATION).reprompt(ASK_STATION).getResponse();
      }
      return answer(input, await speakDepartures(station, directionFromSlot(input)));
    },
  };

  const FavouriteDepartures: RequestHandler = {
    canHandle: (input) => isIntent(input, 'FavouriteDeparturesIntent'),
    async handle(input) {
      const [first] = await favourites.list(userId(input));
      if (!first) {
        return input.responseBuilder
          .speak(`You haven't saved a favourite station yet. You can say: add Connolly to my favourites. ${ASK_STATION}`)
          .reprompt(ASK_STATION)
          .getResponse();
      }
      return answer(input, await speakDepartures(first));
    },
  };

  const AddFavourite: RequestHandler = {
    canHandle: (input) => isIntent(input, 'AddFavouriteIntent'),
    async handle(input) {
      const station = stationFromSlot(input);
      if (!station) {
        return input.responseBuilder
          .speak('Which station should I add? For example, say: add Pearse to my favourites.')
          .reprompt('Which station should I add?')
          .getResponse();
      }
      try {
        await favourites.add(userId(input), station.code);
      } catch (err) {
        if (err instanceof FavouriteError) return answer(input, escapeSsml(err.message));
        throw err;
      }
      const speech = `Done. ${station.shortName} is in your favourites. Just say: ask DART times when's my next train.`;
      return answer(input, escapeSsml(speech));
    },
  };

  const RemoveFavourite: RequestHandler = {
    canHandle: (input) => isIntent(input, 'RemoveFavouriteIntent'),
    async handle(input) {
      const station = stationFromSlot(input);
      if (!station) {
        return input.responseBuilder.speak('Which station should I remove?').reprompt('Which station should I remove?').getResponse();
      }
      const removed = await favourites.remove(userId(input), station.code);
      const speech = removed
        ? `OK, I've removed ${station.shortName} from your favourites.`
        : `${station.shortName} isn't one of your favourites.`;
      return answer(input, escapeSsml(speech));
    },
  };

  const Help: RequestHandler = {
    canHandle: (input) => isIntent(input, 'AMAZON.HelpIntent'),
    handle: (input) =>
      input.responseBuilder
        .speak(
          'You can ask for the next DART from any station, like: next DART from Pearse going south. ' +
            'Save a station by saying: add Connolly to my favourites. Then just ask: when is my next train. ' +
            ASK_STATION,
        )
        .reprompt(ASK_STATION)
        .getResponse(),
  };

  const Fallback: RequestHandler = {
    canHandle: (input) => isIntent(input, 'AMAZON.FallbackIntent'),
    handle: (input) =>
      input.responseBuilder.speak(`Sorry, I didn't catch that. ${ASK_STATION}`).reprompt(ASK_STATION).getResponse(),
  };

  const StopOrCancel: RequestHandler = {
    canHandle: (input) => isIntent(input, 'AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'),
    handle: (input) => answer(input, 'Goodbye.'),
  };

  const SessionEnded: RequestHandler = {
    canHandle: (input) => Alexa.getRequestType(input.requestEnvelope) === 'SessionEndedRequest',
    handle: (input) => input.responseBuilder.getResponse(),
  };

  const builder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      Launch,
      GetDepartures,
      FavouriteDepartures,
      AddFavourite,
      RemoveFavourite,
      Help,
      Fallback,
      StopOrCancel,
      SessionEnded,
    )
    .addErrorHandlers({
      canHandle: () => true,
      handle(input, error) {
        console.error(error);
        return input.responseBuilder
          .speak("Sorry, I couldn't get train times from Irish Rail right now. Please try again in a minute.")
          .getResponse();
      },
    });
  if (skillId) builder.withSkillId(skillId);
  return builder;
}
