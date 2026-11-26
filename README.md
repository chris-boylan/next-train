# Next Train?

Live Irish Rail train times as a **mobile-first web app** and an **Alexa skill**, sharing one TypeScript core. Data comes from the free [Irish Rail real-time API](http://api.irishrail.ie/realtime/).

- **Web app:** DART, Enterprise (Dublin–Belfast) and Cork Commuter, each with its own line map and live station pages. There's also a departure board for every Irish Rail station, reached from an all-stations map, and a preview of Dublin Commuter. English and Irish, light and dark.
- **Alexa skill:** DART departures and favourites by voice (DART only so far).

It's unofficial and not affiliated with Iarnród Éireann.

```
packages/
  core/   Irish Rail client, lines and services, stations (English + Irish), departures, favourites (shared)
  api/    Lambda JSON API for the web app (+ local dev server)
  web/    React + Vite frontend
  alexa/  Alexa skill Lambda + generated interaction model
  infra/  AWS CDK stack (eu-west-1): DynamoDB, Lambdas, HTTP API, S3 + CloudFront
```

## Branches

Recent work is on stacked branches, each building on the one before. Merge them in order when they're ready:

| Branch | Adds |
|---|---|
| `main` | DART, Enterprise, Bold Swiss design, bilingual, going-to filter |
| `feature/network-map` | All-stations map, station boards for every station, search, "Next Train?" name |
| `feature/cork-commuter` | Cork Commuter (Rebel red, geography-inspired map), curved map corners |
| `preview/dublin-commuter` | Dublin Commuter preview (all routes vs by route) |

## Using the web app

The first page is a **service picker**: DART, Enterprise or Cork Commuter, plus **Dublin Commuter (preview)** and **All stations**. Choosing a service opens its line map, then a station.

- **Line maps:** tap a station to open it. Search finds stations by English or Irish name, fadas optional, and tolerates small typos ("connoly"). Favourites appear as chips.
- **Station page** (`web/src/TrackView.tsx`):
  - **Tracks:** a fixed-size station sign sits between two tracks. The darker northbound track runs up the left, the lighter southbound track runs down the right, and each arrowhead names where trains in that direction end up.
  - **Trains:** the next 3 trains each way approach the platform. Late trains show ~~scheduled~~ `+delay` expected.
  - **Next stations:** links above and below the station name step to the next station north or south. At a junction, both branches are shown.
  - **Header:** the live clock (Irish time), with the last update time turning red if the data goes stale.
  - **Refresh:** every 30 s while the tab is visible.
- **Going-to filter:** each section ends in "+ N more" (or "Filter"), which opens every departure that way for the next 90 minutes with "going to" chips. Choosing a destination hides trains that won't get you there and dims the other track. A chip under the station name clears it. The choice is remembered per station.
- **Options cog:** language (English | Irish) and appearance (Light | Dark). Light/dark follows the phone unless you choose.
- **Links:** `?service=enterprise&station=DDALK` opens a station directly. The app reopens where you left off.

## Services

| Service | Line | Stations | Map | Colours (north / south) |
|---|---|---|---|---|
| **DART** | Greystones–Bray–Connolly–Howth Junction, then Howth or Malahide | 32 | `LineMap` (hand-drawn) | Green / orange |
| **Enterprise** | Connolly–Drogheda–Dundalk–Newry–Portadown–Belfast | 6 | `SimpleLineMap` | Deep violet / lilac |
| **Cork Commuter** | Cobh and Midleton, meeting at Glounthaune, then Cork Kent and Mallow | 10 | `SchematicMap` (geography-inspired) | Deep / light Rebel red |

- **Where they're defined:** lines are in `core/src/line.ts` (`DART_LINE`, `ENTERPRISE_LINE`, `CORK_LINE`) and services in `core/src/services.ts`. Line helpers take a line and default to the DART, so the Alexa skill is unaffected.
- **Identifying trains:** the API only says "DART" or "Train".
  - **Enterprise:** trains to or from Belfast.
  - **Cork:** commuter (non-"A"-code) trains starting or ending at Cork, Cobh, Midleton or Mallow.
- **Directions:** the station page works out each train's direction from the line layout (from here to its destination). That's because some services' API directions read "To Cork" rather than Northbound/Southbound. On Cork, "northbound" means towards Cork and Mallow, and Cork is a turn-back like Bray.
- **Verification:**
  - **DART:** checked against live trains (`npm run verify-line`).
  - **Enterprise:** five trains in both directions; none called at Lisburn or Lurgan.
  - **Cork:** live Midleton and Mallow runs. The Cobh branch so far comes from recorded data only.
- **Colours:** set with `data-service` on `<html>`, and contrast-checked in light and dark mode. Irish Rail has no Cork-specific branding, so Rebel red is the app's own.

## All stations and station boards

- **All stations** shows every Irish Rail station on one vertical schematic that fits a phone's width (`web/src/NetworkMap.tsx`), with search.
- **Station boards:** tap a station for its board (`web/src/StationBoard.tsx`). It shows every train in the next 90 minutes, grouped by the direction the API gives, each labelled **DART**, **Enterprise**, **InterCity** or **Commuter** (`trainCategory` in `core/src/departures.ts`).
- **InterCity vs Commuter:** InterCity is identified by train codes starting with "A". That's an observed pattern, not documented by Irish Rail.
- **Where the network data comes from:** the API lists station locations but not how they connect. `npm run build-network -w @dart-times/core` samples every running train's stop list, which includes stations passed without stopping, and writes the connections to `web/src/network.data.ts`. Each run adds to earlier ones, so run it at different times to fill gaps. It also merges duplicate station codes, drops links that skip a station, and estimates missing positions. About 16 stations on lightly used lines (Nenagh, Clonmel, Gort…) aren't connected yet.

## Dublin Commuter (preview)

Linked from the first page. A toggle compares two presentations:
- **All routes:** one geography-inspired map, with Connolly and Heuston as the hubs (`web/src/commuterSchematic.ts`).
- **By route:** pick Northern, Western, South Western or South Eastern first, and see just that route.

**How the routes are built:** they're traced through the recorded track connections (`web/src/commuterRoutes.ts`).

**Status:** layout only for now. There are no live times, station names aren't tappable, and the route colours are provisional.

## Maps

| Component | Used for | How it's laid out |
|---|---|---|
| `LineMap` | DART | Hand-drawn branches |
| `SimpleLineMap` | Enterprise (single line) | One straight line |
| `SchematicMap` → `PositionedMap` | Cork, Dublin Commuter preview | Hand-placed positions in `schematics.ts` / `commuterSchematic.ts`, with bend points drawn as curves |
| `BranchLineMap` | Any other branching service | Automatic, from the line's paths (`networkLayout.ts`) |
| `TreeMap` | All stations, commuter "by route" | Automatic: the longest branch carries straight on and shorter branches step right, so it fits a phone's width |

All maps share the flat "Bold Swiss" style: circles for ends of lines, junctions and turn-backs, ticks for other stations, and curved corners.

## What's shared (core)

| Concern | Where |
|---|---|
| Fetching and parsing the XML API (30 s cache, 5 s timeout) | `core/src/irishRailClient.ts` |
| Lines, routes, neighbours, directions, "does this train stop at X" | `core/src/line.ts` |
| Services and which trains belong to each | `core/src/services.ts` |
| Stations, aliases, fuzzy search (English and Irish) | `core/src/stations.ts`, `stations.*.data.ts` |
| Official Irish station names | `core/src/stations.ga.ts` |
| Departures: filtering, train categories, going-to filter | `core/src/departures.ts` |
| Wording ("in 5 minutes", "32 minutes late") | `core/src/describe.ts` |
| Favourites rules + DynamoDB adapter | `core/src/favourites.ts`, `core/src/dynamo.ts` |
| Alexa `STATION` slot values and synonyms | Generated from the DART stations |

Both apps store favourites in one table, keyed `web:<device id>` or `alexa:<user id>`. Syncing between them would need Alexa account linking and a web login.

## API

- **`GET /api/stations`:** DART stations.
- **`GET /api/stations/:code/departures?service=dart|enterprise|cork&direction=&limit=`:** a service's trains at one of its stations.
- **`GET /api/stations/:code/departures?service=all`:** every train at any Irish Rail station, with categories.
- **`GET | PUT | DELETE /api/favourites[/:code]`:** needs an `x-device-id` header.

## English and Irish

- **Station names** are Iarnród Éireann's official Irish names, for all DART, Enterprise and Cork stations. They come from its Irish-language timetables-by-station page, cross-checked against its bilingual timetables and logainm.ie (sources are noted in `stations.ga.ts`). Other stations show their English name.
- **Interface text** is in `web/src/i18n.tsx`. Irish phrasing uses "go dtí", which doesn't change place names, and avoids nouns after numbers.
- **Capitals:** Irish prefixes stay lowercase in capitalised text ("CNOC AN tSALAINN"), via the `Caps` component.
- **For a fluent speaker to review:**
  - All interface wording.
  - The short forms for Howth Junction and Sandycove.
  - Grand Canal Dock: Irish Rail uses both "Dug" and "Duga".
  - Service and route names, which are kept in English for now ("Cork Commuter", "Dublin Commuter", "Northern"…).

## Alexa skill

DART only. "Alexa, ask dart times when's the next train from Connolly going south", "add Pearse to my favourites", "when's my next train". Its invocation name is still "dart times". "next train" would likely be rejected by Amazon as too generic, and it can't be changed once published, so it needs choosing before launch.

## Local development

```bash
npm install
npm test                       # unit tests (fixtures recorded from the real API)
npm run typecheck
npm run dev:api                # http://localhost:3001 (in-memory favourites)
npm run dev:web                # http://localhost:5173, proxies /api to the dev API

npm run smoke -- connolly south          # live: next DARTs from a station
npm run verify-line                      # live: check DART_LINE against running trains
npm run build-network -w @dart-times/core    # live: add to the all-stations network data
npm run update-stations -w @dart-times/core  # regenerate the DART station snapshot
npm run alexa:model                      # regenerate the Alexa interaction model
```

## Deploying

Needs AWS credentials, and an [Amazon developer account](https://developer.amazon.com/alexa/console/ask) for the skill.

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

Then test with `ask dialog --locale en-IE` from `packages/alexa`.

## API quirks handled

**The API itself**
- **No versioning, no changelog:** changes can arrive unannounced.
- **Format and access:** XML only, no CORS headers, and the HTTPS endpoint returns 500. All calls go through our server over HTTP.
- **Only "DART" or "Train" as a train type:** services are identified by route, and InterCity by its "A" train-code pattern.

**Station data**
- **Trailing spaces in codes** (`TARA `). Name lookups are unreliable, so names are resolved to codes ourselves.
- **Duplicate codes:** some stations are listed under several codes (Hazelhatch, Adamstown…), and some entries are junctions, not stations. Moira has coordinates of 0, 0.
- **Kilcoole** is in the DART station list, but no DART serves it.

**Departures**
- **Terminating trains** are listed with `Locationtype=D` and `Expdepart=00:00`, and are filtered out.
- **Directions** outside the DART read "To Cork", "To Maynooth" and so on. These look like line directions, not destinations.
- **Look-ahead:** live data covers at most 90 minutes.

**Stop lists**
- **Cancelled stops** (`LocationType=C`) are skipped, so a train that starts partway still matches its line.
- **Missing stations:** some stop lists leave out newer stations, e.g. Woodbrook.

## Maintenance

- **After a timetable or network change** (e.g. DART+ extensions), run `npm run verify-line`. DART+ will move the Maynooth, Kildare and Drogheda routes to the DART over the coming years.
- **After `update-stations`,** run `npm run alexa:model` and `ask deploy`, so the voice model matches.
- **Extra station names** for voice and search go in `EXTRA_ALIASES` in `core/src/stations.ts`.
