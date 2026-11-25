# Next Train

Live DART departures as a **web app** and an **Alexa skill**, sharing one TypeScript core. Data comes from the free [Irish Rail real-time API](http://api.irishrail.ie/realtime/).

```
packages/
  core/   Irish Rail client, station search, departure filtering, wording, favourites rules (shared)
  api/    Lambda JSON API for the web app (+ local dev server)
  web/    React + Vite frontend
  alexa/  Alexa skill Lambda + generated interaction model
  infra/  AWS CDK stack (eu-west-1): DynamoDB, Lambdas, HTTP API, S3 + CloudFront
```

## What's shared

| Concern | Where |
|---|---|
| Fetching and parsing the XML API (30s cache, 5s timeout) | `core/src/irishRailClient.ts` |
| Line shape: trunk, Howth/Malahide branches, routes, neighbours | `core/src/line.ts` |
| Station list, aliases, fuzzy search ("connoly" → Connolly) | `core/src/stations.ts` |
| Departure filtering (DART only, no terminating trains, direction) | `core/src/departures.ts` |
| "in 5 minutes" / "32 minutes late" wording | `core/src/describe.ts` |
| Favourites rules + DynamoDB adapter | `core/src/favourites.ts`, `core/src/dynamo.ts` |
| Alexa `STATION` slot values and synonyms | generated from `core/src/stations.ts` |

Both apps store favourites in one table, keyed `web:<device id>` or `alexa:<user id>`. Syncing favourites between the two would need Alexa account linking plus a web login; that isn't built yet.

## Web app

Built for phones and behaves like a mobile app: it reopens on the last station you viewed, and `?station=PERSE` links straight to a station.

- **Station map** (`web/src/LineMap.tsx`): a schematic of the line drawn from `core/src/line.ts`, with the Malahide branch on the left and Howth on the right, merging at Howth Junction. Tap a station to open it. Favourites show as chips above the map; typing in search switches to a results list.
- **Track view** (`web/src/TrackView.tsx`): the station is a white band between two tracks. Green (northbound) runs up the left, orange (southbound) runs down the right, and each arrowhead names where that direction ends up. The next 3 trains each way approach the platform, showing minutes away, destination and departure time. Late trains show ~~scheduled~~ `+delay` expected. Links above and below the station name step to the next station north or south. At a terminus the track stops at the platform. Refreshes every 30s while the tab is visible.

## Local development

```bash
npm install
npm test                 # all unit tests (fixtures recorded from the real API)
npm run typecheck
npm run smoke -- connolly south   # live: next DARTs from a station
npm run verify-line      # live: check the line definition against running trains

npm run dev:api          # http://localhost:3001 (in-memory favourites)
npm run dev:web          # http://localhost:5173, proxies /api to the dev API
```

## Deploying

Needs AWS credentials for your account, and an [Amazon developer account](https://developer.amazon.com/alexa/console/ask) for the skill.

```bash
# 1. First time only, per account/region
npx cdk bootstrap aws://<account-id>/eu-west-1 -a "npx tsx packages/infra/bin/app.ts"

# 2. Deploy web + API + Alexa Lambda (prints SiteUrl and AlexaFunctionArn)
npm run deploy

# 3. Create/update the skill
npm i -g ask-cli && ask configure
ALEXA_LAMBDA_ARN=<AlexaFunctionArn> npm run alexa:model
cd packages/alexa && ask deploy

# 4. Lock the Lambda to your skill (skill ID is in the Alexa developer console)
npm run deploy -- -c alexaSkillId=amzn1.ask.skill.xxxx
```

Then test with `ask dialog --locale en-IE` from `packages/alexa`, e.g. "open dart times", "ask dart times when's the next train from Connolly going south", "add Pearse to my favourites", "when's my next train".

## Services

The web app opens on a service picker: **DART** or **Enterprise** (Dublin Connolly – Belfast), then that service's line map, then a station.

- Lines are defined in `core/src/line.ts` (`DART_LINE`, `ENTERPRISE_LINE`) and services in `core/src/services.ts`. Line helpers take the line as a parameter and default to the DART, so the Alexa skill is unchanged.
- The Enterprise calls at Connolly, Drogheda, Dundalk, Newry, Portadown and Belfast (Grand Central). That was verified against the stop lists of five trains in both directions; none called at Lisburn or Lurgan. The API has no Enterprise train type, so Enterprise trains are identified as the only Irish Rail trains running to or from Belfast.
- Colours: DART tracks are green and orange. Enterprise tracks are deep violet (to Belfast) and lilac (to Dublin), set with `data-service` on `<html>`.

## English and Irish

The web app is bilingual: the options cog switches between **English** and **Gaeilge** (defaulting to Irish when the phone's language is Irish) and between light and dark.

- **Station names** come from `core/src/stations.ga.ts`: Iarnród Éireann's official Irish names, from its Irish timetables-by-station page, cross-checked against its bilingual DART timetable and logainm.ie. Irish names are searchable, with or without fadas.
- **Interface text** lives in `web/src/i18n.tsx`. Irish phrasing uses "go dtí" (no mutation of place names) and avoids counting nouns after numbers. It should be reviewed by a fluent speaker.
- **Capitals:** Irish prefixes stay lowercase in capitalised text ("CNOC AN tSALAINN"), handled by the `Caps` component.

## The line

```
                                              ┌─ Bayside ─ Sutton ─ Howth
Greystones ─ Bray ─ … ─ Connolly ─ … ─ Howth Junction
                                              └─ Clongriffin ─ Portmarnock ─ Malahide
```

32 stations: 26 on the shared trunk, 3 on each branch. Many trains turn at Bray rather than Greystones. The API's DART station list also includes Kilcoole, but no DART serves it, so it's excluded. `npm run verify-line` checks `core/src/line.ts` against the stop lists of DARTs running now. Cancelled stops (`LocationType=C`) are ignored, so a train that starts partway, e.g. at Howth Junction, still passes.

## Maintenance

- After any timetable or network change (e.g. DART+ extensions), run `npm run verify-line`.

- `npm run update-stations -w @dart-times/core` regenerates the station snapshot from the API. After that, run `npm run alexa:model` and `ask deploy` so the voice model matches.
- Extra names for stations (voice and search) go in `EXTRA_ALIASES` in `core/src/stations.ts`.

## API quirks handled

- XML only, no CORS headers, and the HTTPS endpoint returns 500. All calls go through our server over HTTP.
- Station codes can have trailing spaces (`TARA `). Lookups by name are unreliable, so we resolve names to codes ourselves.
- Trains terminating at a station are listed with `Locationtype=D` and `Expdepart=00:00`. These are filtered out.
- Live data covers at most 90 minutes ahead.
