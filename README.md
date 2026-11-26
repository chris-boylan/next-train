# Next Train?

Live Irish Rail train times as a **mobile-first web app** and an **Alexa skill**, sharing one TypeScript core. Data comes from the free [Irish Rail real-time API](http://api.irishrail.ie/realtime/).

- **Web app:** DART, Enterprise (Dublin–Belfast), Cork Commuter, Dublin Commuter and InterCity, each with its own map and live station pages. There's also a departure board for every Irish Rail station, reached from an all-stations map. English and Irish, light and dark. Installable on the phone's home screen (PWA).
- **Alexa skill:** DART departures and favourites by voice (DART only so far).

It's unofficial and not affiliated with Iarnród Éireann.

```
packages/
  core/   Irish Rail client, lines and services, stations (English + Irish), departures, favourites (shared)
  api/    Lambda JSON API for the web app (+ local dev server)
  web/    React + Vite frontend: screens/, components/, maps/ (+ maps/data/), lib/, styles/
  alexa/  Alexa skill Lambda + generated interaction model
  infra/  AWS CDK stack (eu-west-1): DynamoDB, Lambdas (API via Function URL), S3 + CloudFront
```

## Branches

Everything is merged into `main`. New work goes on a feature branch off `main`. The feature branches below have all been merged in, and are kept for history:

| Branch | Added |
|---|---|
| `feature/network-map` | All-stations map, station boards for every station, search, "Next Train?" name |
| `feature/cork-commuter` | Cork Commuter (Rebel red, geography-inspired map), curved map corners |
| `feature/dublin-commuter` | Dublin Commuter service: geography-inspired map, live boards grouped by route, tappable map dots |
| `feature/intercity` | InterCity service: six routes, live boards grouped by route, map drawn from the all-stations layout |
| `feature/pwa-deploy` | Installable PWA, optional custom domain, API Gateway replaced by a Lambda Function URL, 20 s edge cache on departures, budget alert |
| `refactor/web-structure` | Web app organised into `screens/`, `components/`, `maps/`, `lib/` and per-area `styles/` |
| `feature/cicd` | GitHub Actions CI/CD with an approval gate and keyless (OIDC) AWS deploys |
| `feature/favourites-home` | Options choice to show favourites in each service or together on the home page; favourites for every service's stations |

## Using the web app

The app always opens on the **service picker**: DART, Enterprise, Cork Commuter, Dublin Commuter, InterCity, or **All stations**. Choosing a service opens its map, then a station.

- **Line maps:** tap a station to open it. Search finds stations by English or Irish name, fadas optional, and tolerates small typos ("connoly"). Favourites appear as chips: on each service's page, or all together on the home page if the options cog says so (a home-page favourite opens every train at that station).
- **Station page** (`web/src/screens/TrackView.tsx`):
  - **Tracks:** a fixed-size station sign sits between two tracks. The darker northbound track runs up the left, the lighter southbound track runs down the right, and each arrowhead names where trains in that direction end up.
  - **Trains:** the next 3 trains each way approach the platform. Late trains show ~~scheduled~~ `+delay` expected.
  - **Next stations:** links above and below the station name step to the next station north or south. At a junction, both branches are shown.
  - **Header:** the live clock (Irish time), with the last update time turning red if the data goes stale.
  - **Refresh:** every 30 s while the tab is visible.
- **Going-to filter:** each section ends in "+ N more" (or "Filter"), which opens every departure that way for the next 90 minutes with "going to" chips. Choosing a destination hides trains that won't get you there and dims the other track. A chip under the station name clears it. The choice is remembered per station.
- **Options cog:** language (English | Irish) and appearance (Light | Dark). Light/dark follows the phone unless you choose. On an iPhone or iPad in Safari it also explains how to install the app.
- **Install (PWA):** on iPhone, Safari → Share → **Add to Home Screen**; Android/Chrome offers "Install app". It then opens full-screen with its own icon. A service worker (`vite-plugin-pwa`, configured in `web/vite.config.ts`) caches the app itself so it opens instantly; live times always come from the network. On iOS a home-screen app has its own storage, separate from Safari, so favourites and settings start fresh after installing. Icons are generated from `web/public/icon.svg` with `npx pwa-assets-generator` in `packages/web`, and committed.
- **Links:** `?service=enterprise&station=DDALK` opens a station directly. Without a link, the app opens on the service picker.

## Services

| Service | Line | Stations | Map | Colours (north / south) |
|---|---|---|---|---|
| **DART** | Greystones–Bray–Connolly–Howth Junction, then Howth or Malahide | 32 | `LineMap` (hand-drawn) | Green / orange |
| **Enterprise** | Connolly–Drogheda–Dundalk–Newry–Portadown–Belfast | 6 | `SimpleLineMap` | Deep violet / lilac |
| **Cork Commuter** | Cobh and Midleton, meeting at Glounthaune, then Cork Kent and Mallow | 10 | `SchematicMap` (geography-inspired) | Deep / light Rebel red |
| **Dublin Commuter** | Four routes from Connolly and Heuston (below) | 70 | `RoutesMap` (geography-inspired) | One colour per route |
| **InterCity** | Six routes from Heuston and Connolly (below) | 85 | `RoutesMap` (geography-inspired, from the all-stations map) | One colour per route |

- **Where they're defined:** lines are in `core/src/line.ts` (`DART_LINE`, `ENTERPRISE_LINE`, `CORK_LINE`) and services in `core/src/services.ts`. Line helpers take a line and default to the DART, so the Alexa skill is unaffected.
- **Identifying trains:** the API only says "DART" or "Train".
  - **Enterprise:** trains to or from Belfast.
  - **Cork:** commuter (non-"A"-code) trains starting or ending at Cork, Cobh, Midleton or Mallow.
  - **Dublin Commuter:** other commuter trains (not DART, not "A"-code InterCity, not Enterprise or Cork).
  - **InterCity:** "A"-code trains other than the Enterprise. Every InterCity train seen live has an "A" code, including local runs such as Ennis–Limerick Junction and Tralee–Mallow.
- **Directions:** the station page works out each train's direction from the line layout (from here to its destination). That's because some services' API directions read "To Cork" rather than Northbound/Southbound. On Cork, "northbound" means towards Cork and Mallow, and Cork is a turn-back like Bray.
- **Verification:**
  - **DART:** checked against live trains (`npm run verify-line`).
  - **Enterprise:** five trains in both directions; none called at Lisburn or Lurgan.
  - **Cork:** live Midleton and Mallow runs. The Cobh branch so far comes from recorded data only.
- **Colours:** set with `data-service` on `<html>`, and contrast-checked in light and dark mode. Irish Rail has no Cork-specific branding, so Rebel red is the app's own.

## All stations and station boards

- **All stations** shows every Irish Rail station on one vertical schematic that fits a phone's width (`web/src/maps/NetworkMap.tsx`), with search.
- **Station boards:** tap a station for its board (`web/src/screens/StationBoard.tsx`). It shows every train in the next 90 minutes, grouped by the direction the API gives, each labelled **DART**, **Enterprise**, **InterCity** or **Commuter** (`trainCategory` in `core/src/departures.ts`).
- **InterCity vs Commuter:** InterCity is identified by train codes starting with "A". That's an observed pattern, not documented by Irish Rail.
- **Where the network data comes from:** the API lists station locations but not how they connect. `npm run build-network -w @dart-times/core` samples every running train's stop list, which includes stations passed without stopping, and writes the connections to `web/src/maps/data/network.data.ts`. Each run adds to earlier ones, so run it at different times to fill gaps. It also merges duplicate station codes, drops links that skip a station, and estimates missing positions. About 16 stations on lightly used lines (Nenagh, Clonmel, Gort…) aren't connected yet.

## Dublin Commuter

Four routes, defined in `core/src/commuter.ts` with each route's paths running city end first:

| Route | Runs |
|---|---|
| **Northern** | Connolly – Malahide – Drogheda – Dundalk |
| **Western** | Connolly – Drumcondra – Broombridge – Clonsilla – Maynooth, with M3 Parkway (from Clonsilla) and Docklands (from Broombridge) |
| **South Western** | Heuston, or Grand Canal Dock via Connolly and the Phoenix Park tunnel, to Park West – Hazelhatch – Kildare – Portlaoise |
| **South Eastern** | Connolly – down the DART line – Greystones – Wicklow – Arklow – Gorey |

- **Map** (`web/src/maps/RoutesMap.tsx`, shared with InterCity): a toggle switches between **All routes**, one geography-inspired map with Connolly and Heuston as hubs (`web/src/maps/data/commuterSchematic.ts`), and **By route**, which shows one route at a time.
- **Station boards:** commuter stations can be on several routes (Connolly is on four), so tapping one opens a board grouped by route and direction, e.g. "Northern · towards Drogheda / Dundalk", rather than the two-track page.
  - **How trains are placed** (`commuterHeading`): on a route serving both this station and the destination if there is one. Otherwise, a train heading into the city centre goes under this station's route, and a train running through the city goes under its destination's route.
  - **Inbound groups** read "towards Dublin", except at city-centre stations, where they name the destination.
  - **Unplaced trains:** those to places off the network (e.g. Longford) are grouped by the API's own direction.
- **Verification:** the routes were traced from track connections recorded from live trains. All 70 station codes answer in the departures feed (Curragh and Gorey were quiet at 10:00, which is expected).

## InterCity

Six routes, defined in `core/src/intercity.ts`. Each route's paths run from its hub outwards: Dublin for most, and Limerick Junction, Cork, Ballybrophy or Limerick for the cross-country lines. The paths list the stations InterCity trains call at, traced from live trains' stop lists, so in Dublin they skip most commuter stations.

| Route | Runs |
|---|---|
| **Cork & Kerry** | Heuston – Kildare – Portlaoise – Thurles – Limerick Junction – Mallow – Cork, with Mallow – Killarney – Tralee (also from Cork) |
| **Galway & Mayo** | Heuston – Portarlington – Tullamore – Athlone – Athenry – Galway, with Athlone – Claremorris – Westport and Manulla Junction – Ballina |
| **Limerick & Ennis** | Heuston – Limerick Junction – Limerick, Ballybrophy – Nenagh – Limerick, and Limerick – Ennis – Gort – Athenry – Galway |
| **Waterford** | Heuston – Kildare – Carlow – Kilkenny – Waterford, and Limerick Junction – Clonmel – Waterford |
| **Sligo** | Connolly – Drumcondra – Maynooth – Mullingar – Longford – Sligo |
| **Rosslare** | Connolly – Dún Laoghaire – Bray – Wicklow – Arklow – Gorey – Wexford – Rosslare Europort |

- **Station boards** are grouped by route and by the next station each train runs to, so trains leaving in different directions get their own groups even on one route (at Mallow: towards Cork, towards Tralee, towards Heuston). Each group names where its trains are going.
  - **How trains are placed** (`intercityHeading`): on a route serving both this station and the destination. Routes share track (Heuston to Limerick Junction carries Cork, Kerry and Limerick trains), so the route that also serves the train's origin wins.
- **Map:** **All routes** is drawn from the all-stations map (`web/src/maps/data/intercitySchematic.ts`), in its compact type: each station keeps its place there, and each connection follows the same track, through the commuter stations InterCity trains skip. Shared track shows each route's colour side by side. Stations the all-stations map doesn't place yet (the Nenagh line, Gort–Craughwell, Limerick Junction–Waterford) are listed under the map and appear once it places them. **By route** shows one route at a time, with every station.
- **Left out:** Campile, Ballycullane, Wellingtonbridge and Bridgetown are in the API's station list, but the Rosslare–Waterford line has had no passenger trains since 2010.

## Maps

| Component | Used for | How it's laid out |
|---|---|---|
| `LineMap` | DART | Hand-drawn branches |
| `SimpleLineMap` | Enterprise (single line) | One straight line |
| `SchematicMap` → `PositionedMap` | Cork, Dublin Commuter and InterCity (all routes) | Hand-placed positions in `schematics.ts` / `commuterSchematic.ts`, with bend points drawn as curves |
| `BranchLineMap` | Any other branching service | Automatic, from the line's paths (`networkLayout.ts`) |
| `TreeMap` | Dublin Commuter and InterCity "by route" | Automatic: the longest branch carries straight on and shorter branches step right, so it fits a phone's width |

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
- **`GET /api/stations/:code/departures?service=dart|enterprise|cork|commuter&direction=&limit=`:** a service's trains at one of its stations.
- **`GET /api/stations/:code/departures?service=all`:** every train at any Irish Rail station, with categories.
- **`GET | PUT | DELETE /api/favourites[/:code]`:** needs an `x-device-id` header.

## English and Irish

- **Station names** are Iarnród Éireann's official Irish names, for every station on every service, from Irish Rail's Irish station page (or, for Curragh and Manulla Junction, its station sign and Irish station page). On the all-stations map, Northern Ireland stations show the official Irish name of the place they're named after, from logainm.ie, where there is one; stations named after buildings or developments (City Hospital, Lanyon Place…) stay in English. They come from that page, cross-checked against its bilingual timetables and logainm.ie (sources are noted in `stations.ga.ts`). Stations elsewhere on the network show their English name.
- **Interface text** is in `web/src/lib/i18n.tsx`. Irish phrasing uses "go dtí", which doesn't change place names, and avoids nouns after numbers.
- **Capitals:** Irish prefixes stay lowercase in capitalised text ("CNOC AN tSALAINN"), via the `Caps` component.
- **For a fluent speaker to review:**
  - All interface wording.
  - The short forms for Howth Junction and Sandycove.
  - Grand Canal Dock: Irish Rail uses both "Dug" and "Duga".
  - Places where Irish Rail's own sources disagree (Docklands "Dugthailte" vs "Ceantar na nDugaí", Drumcondra, Newbridge, M3 Parkway). We use the station page's form.
  - Our short forms for Clondalkin, Hazelhatch and Sallins, which mirror the English API names.
  - Service and route names. InterCity and Commuter use Irish Rail's own Irish labels ("Idirchathrach", "Comaitéara"); "Comaitéara Bhaile Átha Cliath / Chorcaí" and the commuter route names ("Líne an Tuaiscirt"…) are our own wording, as Irish Rail publishes none. DART and Enterprise are brand names.

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

**What runs where:** CloudFront serves the site from S3 and sends `/api/*` to the API Lambda's Function URL. The Function URL only accepts requests signed by this distribution, so there's no API Gateway and no per-request API charge. `/api/stations/*` (live departures) is cached at the edge for 20 s, so a busy station costs one Lambda call per 20 s. Favourites are never cached. At hobby traffic this all sits within AWS's always-free allowances, apart from $0.50/month for a Route 53 hosted zone if you use a custom domain.

**Optional deploy flags** (add them to every `npm run deploy`, or put them in `packages/infra/cdk.json` under `context`):
- `-c domainName=example.ie`: serve the site on your own domain (and `www.`). Buy the domain in Route 53 (Registered domains), which creates its hosted zone. The certificate goes in a small extra stack in us-east-1, because CloudFront only accepts certificates from there. Bootstrap us-east-1 once as well.
- `-c budgetEmail=you@example.com`: a $5/month AWS Budgets alert, emailed when actual spend passes $4 (80%) and $5, and when the month's forecast goes over $5. Don't commit the email.

```bash
# 1. First time only, per account/region (add us-east-1 if you use a custom domain)
npx cdk bootstrap aws://<account-id>/eu-west-1 aws://<account-id>/us-east-1 -a "npx tsx packages/infra/bin/app.ts"

# 2. Deploy web + API + Alexa Lambda (prints SiteUrl and AlexaFunctionArn)
npm run deploy -- -c domainName=example.ie -c budgetEmail=you@example.com   # flags optional

# 3. Create/update the skill
npm i -g ask-cli && ask configure
ALEXA_LAMBDA_ARN=<AlexaFunctionArn> npm run alexa:model
cd packages/alexa && ask deploy

# 4. Lock the Lambda to your skill (skill ID is in the Alexa developer console)
npm run deploy -- -c alexaSkillId=amzn1.ask.skill.xxxx
```

Then test with `ask dialog --locale en-IE` from `packages/alexa`.

### CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml` runs typecheck, tests, the web build and `cdk synth` on every pull request and push. On `main` it then deploys, after an approval in GitHub (the `production` environment: Settings → Environments).

- **No AWS keys in GitHub:** the deploy job swaps a GitHub-signed token for short-lived credentials for the `next-train-github-deploy` role. Only this repo's `production` environment can assume it, and it can only hand off to CDK's bootstrap roles.
- **That role lives in its own stack,** `NextTrainGitHubDeploy`, deployed by hand once (`npm run deploy:github -w @dart-times/infra -- --profile <profile>`). `npm run deploy` only deploys the `DartTimes*` stacks, so the pipeline can't change its own permissions.
- **Settings on the `production` environment:** variable `AWS_DEPLOY_ROLE_ARN` (output of that stack), optional variable `DOMAIN_NAME`, and optional secret `BUDGET_EMAIL`.
- **Domain lookups in CI:** after the first local deploy with `-c domainName=…`, commit `packages/infra/cdk.context.json`, so CI doesn't need Route 53 lookup permissions.

### Later: an App Store app

The plan is to wrap this same web build in a native iOS app with [Capacitor](https://capacitorjs.com/), once the web version has proven itself. It will need:
- The Apple Developer Program ($99/year), and Xcode.
- An absolute API base URL in `web/src/lib/api.ts` (e.g. a `VITE_API_BASE` env var), because the app's pages are served from `capacitor://localhost`, not the site.
- CORS headers for `capacitor://localhost` on `/api/*`, from the handler or a CloudFront response headers policy.
- App icons, reusing `web/public/icon.svg`.
- At least one genuinely native feature (a home-screen widget, haptics), because Apple rejects apps that are only a website in a wrapper.

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
