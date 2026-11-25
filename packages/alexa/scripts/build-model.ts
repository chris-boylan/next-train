// Generates the Alexa interaction models and skill manifest from the shared station list,
// so station names and synonyms have one source of truth (packages/core/src/stations.ts).
// Usage: ALEXA_LAMBDA_ARN=arn:aws:lambda:... npm run alexa:model
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DART_STATIONS, type Station } from '@dart-times/core';

const LOCALES = ['en-IE', 'en-GB'] as const;
const root = fileURLToPath(new URL('../skill-package/', import.meta.url));

/** Alexa slot synonyms work best as plain words: drop accents and punctuation. */
function spoken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stationSlotValue(station: Station) {
  const value = spoken(station.shortName);
  const synonyms = [...new Set([station.name, ...station.aliases].map(spoken))].filter(
    (s) => s && s.toLowerCase() !== value.toLowerCase(),
  );
  return { id: station.code, name: { value, synonyms } };
}

const departureSamples = [
  'when is the next dart from {station}',
  "when's the next dart from {station}",
  'when is the next train from {station}',
  "when's the next train from {station}",
  'next dart from {station}',
  'next train from {station}',
  'darts from {station}',
  'trains from {station}',
  'departures from {station}',
  'next {direction} dart from {station}',
  'next {direction} train from {station}',
  "when's the next {direction} dart from {station}",
  "when's the next {direction} train from {station}",
  'next dart from {station} going {direction}',
  'next train from {station} going {direction}',
  '{direction} darts from {station}',
  '{direction} trains from {station}',
  '{station}',
  '{station} going {direction}',
];

const interactionModel = {
  interactionModel: {
    languageModel: {
      invocationName: 'dart times',
      intents: [
        { name: 'AMAZON.CancelIntent', samples: [] },
        { name: 'AMAZON.HelpIntent', samples: [] },
        { name: 'AMAZON.StopIntent', samples: [] },
        { name: 'AMAZON.NavigateHomeIntent', samples: [] },
        { name: 'AMAZON.FallbackIntent', samples: [] },
        {
          name: 'GetDeparturesIntent',
          slots: [
            { name: 'station', type: 'STATION' },
            { name: 'direction', type: 'DIRECTION' },
          ],
          samples: departureSamples,
        },
        {
          name: 'FavouriteDeparturesIntent',
          slots: [],
          samples: [
            "when's my next train",
            'when is my next train',
            "when's my next dart",
            'when is my next dart',
            'my next train',
            'my next dart',
            'check my station',
          ],
        },
        {
          name: 'AddFavouriteIntent',
          slots: [{ name: 'station', type: 'STATION' }],
          samples: [
            'add {station} to my favourites',
            'add {station} to favourites',
            'save {station} as a favourite',
            'set {station} as my favourite',
            'make {station} my favourite station',
            'favourite {station}',
          ],
        },
        {
          name: 'RemoveFavouriteIntent',
          slots: [{ name: 'station', type: 'STATION' }],
          samples: [
            'remove {station} from my favourites',
            'remove {station} from favourites',
            'delete {station} from my favourites',
            'forget {station}',
          ],
        },
      ],
      types: [
        { name: 'STATION', values: DART_STATIONS.map(stationSlotValue) },
        {
          name: 'DIRECTION',
          values: [
            {
              id: 'Northbound',
              name: { value: 'northbound', synonyms: ['north', 'northern', 'towards Howth', 'towards Malahide'] },
            },
            {
              id: 'Southbound',
              name: { value: 'southbound', synonyms: ['south', 'southern', 'towards Bray', 'towards Greystones'] },
            },
          ],
        },
      ],
    },
  },
};

const localeInfo = {
  name: 'DART Times',
  summary: 'Live DART departures from any station, from Irish Rail real-time data.',
  description:
    'Ask for the next DARTs from any station on the Dublin Area Rapid Transit line, optionally northbound or southbound. ' +
    'Save favourite stations and just ask when your next train is. Data from the Irish Rail real-time API.',
  examplePhrases: [
    'Alexa, open dart times',
    "Alexa, ask dart times when's the next train from Connolly",
    "Alexa, ask dart times when's my next train",
  ],
  keywords: ['DART', 'Irish Rail', 'Dublin', 'train', 'commute'],
};

const manifest = {
  manifest: {
    manifestVersion: '1.0',
    publishingInformation: {
      locales: Object.fromEntries(LOCALES.map((l) => [l, localeInfo])),
      isAvailableWorldwide: false,
      distributionCountries: ['IE', 'GB'],
      category: 'NAVIGATION_AND_TRIP_PLANNER',
      testingInstructions: 'Ask for departures from a DART station, e.g. "next DART from Connolly".',
    },
    privacyAndCompliance: {
      allowsPurchases: false,
      usesPersonalInfo: false,
      isChildDirected: false,
      isExportCompliant: true,
      containsAds: false,
      locales: Object.fromEntries(LOCALES.map((l) => [l, {}])),
    },
    apis: {
      custom: {
        endpoint: { uri: process.env.ALEXA_LAMBDA_ARN ?? 'REPLACE_WITH_ALEXA_FUNCTION_ARN' },
      },
    },
  },
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  mkdirSync(`${root}interactionModels/custom`, { recursive: true });
  for (const locale of LOCALES) {
    writeFileSync(`${root}interactionModels/custom/${locale}.json`, JSON.stringify(interactionModel, null, 2) + '\n');
  }
  writeFileSync(`${root}skill.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${LOCALES.length} interaction models (${DART_STATIONS.length} stations) and skill.json to ${root}`);
  if (!process.env.ALEXA_LAMBDA_ARN) console.warn('ALEXA_LAMBDA_ARN not set: skill.json has a placeholder endpoint.');
}
