# Next Train?

Live Irish Rail train times as a **mobile-first web app** and an **Alexa skill**, sharing one TypeScript core. Data comes from the free [Irish Rail real-time API](http://api.irishrail.ie/realtime/).

- **Web app:** DART, Enterprise (Dublin–Belfast), Cork Commuter, Dublin Commuter and InterCity, each with its own map and live station pages. There's also a departure board for every Irish Rail station, reached from an all-stations map. English and Irish, light and dark. Installable on the phone's home screen (PWA).
- **Alexa skill:** DART departures and favourites by voice (DART only so far).

Live at **https://nexttrain.ie**. It's unofficial and not affiliated with Iarnród Éireann.

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
| `chore/daily-api-check` | Daily live check of the Irish Rail API, opening an issue on failure |
| `fix/small-screens` | Station page fits iPhone SE and 320px-wide phones |
| `feat/custom-domain` | Site served at https://nexttrain.ie (and www) |
| `feat/gtfs-timetable` | Timetabled trains beyond the live 90 minutes, from Irish Rail's GTFS (built daily into static files) |
| `feat/translink-nir` | Translink NIR service (no live data); NI layout fixes on the all-stations map |
| `feat/help-page` | Help & about page with a feedback form (DynamoDB + SNS email) |
| `feat/train-journey` | Tap a train for its stops to the terminus with expected times |
| `feature/favourites-home` | Options choice to show favourites in each service or together on the home page; favourites for every service's stations |
| `feat/hours-countdown` | Options choice to show times over an hour as hours and minutes (`1h 26 min`) |
| `feat/timetable-on-track` | Timetabled trains on the station page's tracks where there are no live ones |
| `feat/verify-deploy` | Live-site check after every deploy (version, API, timetable, www redirect) |
| `feat/nir-timetable` | NI Railways timetabled trains, from Translink's TransXChange timetable |
| `feat/nir-track-view` | NI Railways stations on the two-track station page, from the timetable |
| `feat/timetable-toggle` | Options choice to hide Irish Rail's timetabled trains (NI Railways keeps its timetable) |
| `feat/view-switch-transition` | Animated switch between a station's tracks and its list board |
| `feat/station-lines` | Two-track station pages for Commuter and InterCity, with a chip per route at hubs; station name switches to the list board |
| `fix/deploy-on-request` | Pipeline deploys only when run by hand, not on every merge |
| `feat/live-trains` | Live trains on the DART and Enterprise maps behind a "Live trains" toggle, with a tap-for-details train card |
| `feat/ios-header-and-timetable-alerts` | Every screen pinned so the header never moves on iOS, cog always far right, maps keep their place; alerts when the timetable is out of date |

## Using the web app

The app always opens on the **service picker**: DART, Dublin Commuter, InterCity, Cork Commuter, Enterprise, Translink NIR, or **All stations**. Choosing a service opens its map, then a station.

- **Line maps:** tap a station to open it. Search finds stations by English or Irish name, fadas optional, and tolerates small typos ("connoly"). Favourites appear as chips: on each service's page, or all together on the home page if the options cog says so (a home-page favourite opens every train at that station).
- **Station page** (`web/src/screens/TrackView.tsx`):
- **List or tracks:** tap the station name (☰) for a list board of the same station; on the board, tap the name (⇅) for the tracks again. The choice is remembered on the device (`useStationView`). The switch animates (`web/src/lib/viewSwitch.ts`): to the board, the trains and times fade, the tracks slide off backwards (green down, orange up), then the sign moves up, narrowing into the board's sign as it goes; back to the tracks, the same in reverse. Instant with reduced motion.
  - **Tracks:** a fixed-size station sign sits between two tracks. The darker northbound track runs up the left, the lighter southbound track runs down the right, and each arrowhead names where trains in that direction end up.
  - **Trains:** the next 3 trains each way approach the platform. Late trains show ~~scheduled~~ `+delay` expected.
  - **Next stations:** links above and below the station name step to the next station north or south. At a junction, both branches are shown.
  - **Header:** the live clock (Irish time), with the last update time turning red if the data goes stale.
  - **Refresh:** every 30 s while the tab is visible.
- **Train look-ahead:** tap a train on the station page. The station sign and the other track fade, the train's track glides to the centre and runs the full height, and the train settles at the end it's coming from (bottom for northbound, top for southbound). Its stops to the terminus line the track with expected arrival time, minutes away and any delay, plus where the train is now ("Left Tara Street 1 min ago"). Tap the train or Close to go back. Data: `GET /api/trains/:code/journey?from=STATION` (`buildJourney` in `core/src/journey.ts`, from `getTrainMovementsXML`), cached at the edge for 20 s; refreshed every 30 s while open (`web/src/components/JourneyView.tsx`).
- **Going-to filter:** each section ends in "+ N more" (or "Filter"), which opens every departure that way for the next 90 minutes with "going to" chips. Choosing a destination hides trains that won't get you there and dims the other track. A chip under the station name clears it. The choice is remembered per station.
- **Options cog:** language (English | Irish), appearance (Light | Dark), where favourites go, and whether Irish Rail's timetabled trains show (On | Off, on by default; NI Railways always shows its timetable, `useTimetabledTrains`, applied in `useScheduled`), how times over an hour read (Minutes | Hours & mins, i.e. `86 min` or `1h 26 min`; minutes by default, saved per device). Light/dark follows the phone unless you choose. On an iPhone or iPad in Safari it also explains how to install the app.
- **Help & about** (options cog, or `?help`): how to read a station page, tips, where the times come from, privacy, and a **questions & feedback** form. Messages go to `POST /api/feedback`, are stored in the `Feedback` DynamoDB table for a year, and emailed to the owner through an SNS topic (subscribed to `budgetEmail`; AWS sends a one-off "Confirm subscription" email that must be clicked). Spam limits: a hidden honeypot field, at least 3 s on the form, 3 messages per device per hour and 50 a day in total (`FEEDBACK_LIMITS` in `core/src/feedback.ts`). The help page also shows the build date and commit.
- **Options cog:** language (English | Irish) and appearance (Light | Dark). Light/dark follows the phone unless you choose. On an iPhone or iPad in Safari it also explains how to install the app.
- **Help & about** (options cog, or `?help`): how to read a station page, tips, where the times come from, privacy, and a **questions & feedback** form. Messages (up to 1,000 characters, with a required email address so they can be answered) go to `POST /api/feedback`, are stored in the `Feedback` DynamoDB table for a year, and emailed to the owner through an SNS topic (subscribed to `budgetEmail`; AWS sends a one-off "Confirm subscription" email that must be clicked). Spam limits: a hidden honeypot field, at least 3 s on the form, 3 messages per device per hour and 50 a day in total (`FEEDBACK_LIMITS` in `core/src/feedback.ts`). The help page also shows the build date and commit.
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

## Translink NIR

Northern Ireland Railways, as its own service (Translink's teal and lime on the tile). **There's no live data**: Irish Rail's feed has no NI Railways trains, and OpenDataNI's real-time feed isn't working. So NIR trains are shown at their **timetabled** times, from now. Belfast Grand Central, Portadown and Newry also show their live Enterprise trains.

- **Station page:** the same two-track page as the DART, on `NIR_TRACK_LINE` (`core/src/nir.ts`): one line from Newry through Portadown, Lisburn and **Grand Central** (a through station) across the city to Lanyon Place, branching to Bangor, and at York Street to Larne and Derry (Portrush at Coleraine). So "towards Belfast" from Portadown is Northbound, as on the Enterprise. NIR trains show their **clock time** as the big number (a countdown would look live) with a **Timetable** tag; they're solid at stations with no live trains and hollow beside live Enterprise trains, which they fall in among in time order. They can't be tapped (no live journey). After the last train the page says **No more trains today** and shows tomorrow's first ones, tagged **Tomorrow**. The header says "timetable only".
- **All-stations map:** NI stations open a station board with the same timetabled trains.

### NIR timetable

- **Source:** "Translink Northern Ireland Rail Timetable Data" on OpenDataNI (TransXChange XML, Open Government Licence; https://admin.opendatani.gov.uk/dataset/nir20160126v2). It also has the Enterprise, which is skipped: Irish Rail's GTFS has it, with the live API's train codes.
- **Parsing:** `core/src/transxchange.ts`. Each journey has a start time and a journey pattern whose links give run and wait times, so stop times are added up along the pattern. Stops are matched to our stations by position (and name), as GTFS stops are. Weekly day types and days of (non-)operation are read; there are no bank-holiday rules in Translink's file.
- **Getting a new release in:** OpenDataNI refuses scripted downloads and each release has a new file name, so the daily job can't fetch it. Download the ZIP in a browser and run `npm run nir:upload -- <file.zip> --profile next-train` (the `.xml` inside works too). It goes to the private `TimetableSources` bucket (never served by CloudFront); the upload triggers the timetable job, and the command waits for it, then clears CloudFront's cached `/timetable/*` (cached for an hour, so mixed stations like Grand Central would otherwise lag), so every station shows the new times within a few minutes. It needs AWS credentials that can read the stack, write to S3 and create a CloudFront invalidation.
- **Reminders:** each release covers a few months (the September 2026 one ends on 13 December). The job emails the alerts topic when there's no NIR timetable, within 10 days of the end, and after it. If the NIR file can't be read, Irish Rail's timetable is still written.
- **Locally:** `NIR_TIMETABLE=path/to/release.zip npm run timetable:local` adds NIR to the local timetable files.

| Route | Runs |
|---|---|
| **Bangor** | Grand Central – City Hospital – Botanic – Lanyon Place – Titanic Quarter – Holywood – Bangor |
| **Larne** | Grand Central … Lanyon Place – York Street – Whiteabbey – Carrickfergus – Whitehead – Larne Harbour |
| **Derry** | Grand Central … York Street – Mossley West – Antrim – Ballymena – Coleraine – Castlerock – Derry |
| **Portrush** | Coleraine – University – Dhu Varren – Portrush |
| **Portadown & Newry** | Grand Central – Adelaide – Lisburn – Lurgan – Portadown – Scarva – Poyntzpass – Newry |

- **Where they're defined:** routes in `core/src/nir.ts`, stations (our own `NI_` codes; coordinates from OpenStreetMap) in `core/src/stations.nir.data.ts`, line colours in `web/src/maps/data/nirRoutes.ts` (as on NIR's own maps).
- **Map:** drawn from the all-stations map's Northern Ireland (`nirSchematic` in `web/src/maps/data/intercitySchematic.ts`), like InterCity's.
- Since Grand Central opened (2025), every line but Portadown/Newry leaves Belfast through City Hospital, Botanic and Lanyon Place; York Street replaced Yorkgate (the code `NI_YORKG` is unchanged); Derry trains branch north after York Street and don't call at Whiteabbey. Always "Derry".
- Stations named after buildings or developments (City Hospital, Lanyon Place, Titanic Quarter…) have no Irish name.

## All stations and station boards

- **All stations** shows every station in Ireland on one vertical schematic that fits a phone's width (`web/src/maps/NetworkMap.tsx`), with search. Northern Ireland stations without live times are in italics ("timetable only"); tapping one opens its board with NI Railways' timetabled trains, as from the Translink NIR service.
- **Station boards:** tap a station for its board (`web/src/screens/StationBoard.tsx`). It shows every train in the next 90 minutes, grouped by the direction the API gives, each labelled **DART**, **Enterprise**, **InterCity**, **Commuter** or (timetabled only) **NIR** (`trainCategory` in `core/src/departures.ts`).
- **InterCity vs Commuter:** InterCity is identified by train codes starting with "A". That's an observed pattern, not documented by Irish Rail.
- **Where the network data comes from:** the API lists station locations but not how they connect. `npm run build-network -w @dart-times/core` samples every running train's stop list, which includes stations passed without stopping, and reads Irish Rail's published GTFS timetable, every train's stops, so lines with only a few trains a day (Nenagh, Limerick Junction–Waterford, Ennis–Athenry) are found whatever the time (`--no-timetable` skips it). It writes the connections to `web/src/maps/data/network.data.ts`. Each run adds to earlier ones (`--fresh` starts over). It merges duplicate station codes (keeping the app's own), drops links that skip stations (an express in the timetable lists only its stops), and estimates missing positions. Four stations on the closed Waterford–Rosslare line (Campile, Ballycullane, Wellingtonbridge, Bridgetown) have no trains in the timetable, so the map says so. The all-stations map is laid out by hand, and bends the geography in the south-west to fit those three lines at phone width: Galway is a short stub off Athenry, the Ennis line runs down the west edge to Limerick, Limerick Junction–Waterford loops round to climb the Waterford line, and the Nenagh line runs down from Limerick to its own Ballybrophy stop (a stand-in, `standIns` in `schematics.ts`, so its track doesn't cross the main line). The InterCity map, drawn from the same layout, shows them the same way.

## Dublin Commuter

Four routes, defined in `core/src/commuter.ts` with each route's paths running city end first:

| Route | Runs |
|---|---|
| **Northern** | Connolly – Malahide – Drogheda – Dundalk |
| **Western** | Connolly – Drumcondra – Broombridge – Clonsilla – Maynooth, with M3 Parkway (from Clonsilla) and Docklands (from Broombridge) |
| **South Western** | Heuston, or Grand Canal Dock via Connolly and the Phoenix Park tunnel, to Park West – Hazelhatch – Kildare – Portlaoise |
| **South Eastern** | Connolly – down the DART line – Greystones – Wicklow – Arklow – Gorey |

- **Map** (`web/src/maps/RoutesMap.tsx`, shared with InterCity): a toggle switches between **All routes**, one geography-inspired map with Connolly and Heuston as hubs (`web/src/maps/data/commuterSchematic.ts`), and **By route**, which shows one route at a time.
- **Station page:** the same two-track page as the DART. A station on several routes (Connolly is on four) gets an **All** chip, then one per route (Northern · Western · South Western · South Eastern), above the tracks. It opens on All (every route's trains on one pair of tracks, `allRoutesLine`), or on the route picked on the map; tracks are named by where trains go ("towards Maynooth"), with up heading north. Each train goes on its route (`commuterHeading`); one whose route can't be told still lands on a track (`placeDeparture` in `core/src/stationLines.ts`), so none can drop off the page. Tap the station name for the board instead.
- **Station boards:** grouped by route and direction, e.g. "Northern · towards Drogheda / Dundalk".
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

- **Station page:** two tracks, with an **All** chip and a chip per route where several meet (Kildare, Thurles, Limerick Junction, Athenry, Heuston…), as on the Commuter. On All, a route that disagrees about which side a shared neighbour is on (Galway & Mayo at Kildare, which runs east–west) is turned to match, so Heuston is up for every route there. Tap the station name for the board.
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

**Live trains (DART and Enterprise maps):** a small "Live" switch on a strip along the map's top edge (compass on the right), off by default and remembered per device (one setting for both). While it's on, the map polls `/api/trains` every 30 s (nothing is fetched while it's off) and draws each running train as a small train seen from above (the station page's train), its windscreen and headlights at the front showing which way it's going. Lateness is in the train's card, not on the map. Positions come from one call: `getCurrentTrainsXML_WithTrainType` (DARTs only) for the DART, and `getCurrentTrainsXML` for the others, keeping only the service's trains with the departure boards' `matches` rule (so commuter trains on the Enterprise's Connolly–Drogheda track, and InterCity trains between Cork and Mallow, stay off). Then "Arrived X" stands the train at X, "Departed X" puts it halfway to its next stop, and a last location that's a signal rather than a station (`North Strand Junction`, `PL101`) puts it three-quarters of the way from the station before. Trains sit just left of the track's centre in their direction of travel, so passing trains don't overlap, and glide to their new spot on each refresh. On the north–south DART and Enterprise maps trains point straight up or down. `PositionedMap` can show them too, pointing along the track to the nearest 45° and following its drawn corners, for maps whose lines also run east–west. Cork is the first candidate, but its commuter trains aren't in the positions feed (their boards say "No Information", with expected = scheduled), so it has no Live switch yet. Tapping one opens a card with its destination, next stop, lateness and train code. **Enterprise in Northern Ireland:** Irish Rail doesn't track it on Translink's track. Belfast-bound trains freeze at "Departed Dundalk next stop Newry" for hours after arriving, and Dublin-bound ones are missing until Dundalk. So the Enterprise map also reads its six stations' boards (cached like departures): a "tracked" train its next stop doesn't list is dropped, and a train running untracked is drawn hollow at an estimated place, from how many minutes it is from its next stop at its own speed between the next two. Its card says it isn't tracked. The marker layer (`maps/TrainMarkers.tsx`) only needs a `pointOf(code)`, so other maps can adopt it; the parsing and placement are in `core/src/livetrains.ts`.

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
| Live train positions for the map | `core/src/livetrains.ts` |
| Favourites rules + DynamoDB adapter | `core/src/favourites.ts`, `core/src/dynamo.ts` |
| Alexa `STATION` slot values and synonyms | Generated from the DART stations |

Both apps store favourites in one table, keyed `web:<device id>` or `alexa:<user id>`. Syncing between them would need Alexa account linking and a web login.

## API

- **`GET /api/stations`:** DART stations.
- **`GET /api/stations/:code/departures?service=dart|enterprise|cork|commuter&direction=&limit=`:** a service's trains at one of its stations.
- **`GET /api/stations/:code/departures?service=all`:** every train at any Irish Rail station, with categories.
- **`GET /api/trains?service=dart|enterprise`:** every running train on the service, placed on the line (`at` a station, or `from` → `to` with `progress`). Cached at the edge for 20 s.
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
- `-c budgetEmail=you@example.com`: where help-page feedback is emailed, and a $5/month AWS Budgets alert, emailed at 80% of actual spend and if the forecast goes over. Don't commit the email.

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

`.github/workflows/ci.yml` runs typecheck, tests, the web build and `cdk synth` on every pull request and every merge to `main`. It deploys to AWS only on request: Actions → CI/CD → **Run workflow** on `main` runs the checks and, if they pass, deploys. Merging doesn't deploy. Deploys go one at a time; a newer one waits for a running one rather than interrupting it.

- **Checked after every deploy:** `packages/infra/scripts/verify-deploy.sh` then tests the live site from outside: it loads and serves the commit just deployed, `index.html` is `no-cache`, the API answers, today's timetable file exists (it waits up to 5 min for the post-deploy timetable job), and `www` redirects to the apex. Any failure turns the run red. Run it by hand with `npm run verify-deploy -- https://nexttrain.ie`.

- **No AWS keys in GitHub:** the deploy job swaps a GitHub-signed token for short-lived credentials for the `next-train-github-deploy` role. Only this repo's `production` environment can assume it, and it can only hand off to CDK's bootstrap roles.
- **That role lives in its own stack,** `NextTrainGitHubDeploy`, deployed by hand once (`npm run deploy:github -w @dart-times/infra -- --profile <profile>`). `npm run deploy` only deploys the `DartTimes*` stacks, so the pipeline can't change its own permissions.
- **Settings on the `production` environment:** variable `AWS_DEPLOY_ROLE_ARN` (output of that stack), optional variable `DOMAIN_NAME`, and optional secret `BUDGET_EMAIL`.
- **Domain lookups in CI:** after the first local deploy with `-c domainName=…`, commit `packages/infra/cdk.context.json`, so CI doesn't need Route 53 lookup permissions.

### Daily API check

The Irish Rail API has no versioning or notice of changes, so `.github/workflows/api-check.yml` runs `npm run api-check -w @dart-times/core` every morning at 09:00 UTC. It checks the station list (and that every station the app uses is still in it), that trains are running, and that departures at Connolly, Pearse, Heuston, Cork and Belfast have the expected fields and match our services. After a failed attempt and one retry, it opens a GitHub issue titled "Irish Rail API check failing" (or comments on the open one), which emails you. Run it any time from the Actions tab. GitHub pauses scheduled workflows after 60 days without repo activity; re-enable it from the Actions tab if that happens.

### Later: an App Store app

The plan is to wrap this same web build in a native iOS app with [Capacitor](https://capacitorjs.com/), once the web version has proven itself. It will need:
- The Apple Developer Program ($99/year), and Xcode.
- An absolute API base URL in `web/src/lib/api.ts` (e.g. a `VITE_API_BASE` env var), because the app's pages are served from `capacitor://localhost`, not the site.
- CORS headers for `capacitor://localhost` on `/api/*`, from the handler or a CloudFront response headers policy.
- App icons, reusing `web/public/icon.svg`.
- At least one genuinely native feature (a home-screen widget, haptics), because Apple rejects apps that are only a website in a wrapper.

## Timetable (GTFS)

The live API only looks 90 minutes ahead. Beyond that, station boards and the "+ N more" sheet list **Later · timetable** trains, and on the station page any of a track's three places that no live train fills go to the next timetabled trains (drawn hollow and dashed, tagged **Timetable**, and not tappable; with nothing live that way, "No … trains in the next 90 minutes" stays by the platform). Live always wins: timetabled trains are only shown beyond the live window, and never one already shown live (`scheduledBeyondLive` / `scheduledHeading` in `core/src/timetable.ts`). They come from Irish Rail's GTFS timetable, published free by the National Transport Authority (`https://www.transportforireland.ie/transitData/Data/GTFS_Irish_Rail.zip`, rebuilt nightly, about 10 MB; no key needed). Why it's built this way: [docs/decisions.md](docs/decisions.md).

- **Built once a day:** the timetable job (`api/src/timetableJob.ts`, a Lambda run by EventBridge at 03:30 UTC and once after each deploy) downloads the zip, builds yesterday's, today's and tomorrow's departures for every station (`timetableFiles` in `core/src/timetable.ts`) and writes them to the site bucket as `timetable/<date>/<code>.json`, about 440 small files. Yesterday's are for trains still running after midnight. An S3 rule deletes them after 3 days.
- **Served as static files:** the app fetches `/timetable/<date>/<code>.json` from CloudFront (`web/src/lib/useScheduled.ts`). No API call; a missing file just means no timetable section.
- **If the job fails:** live times carry on, the timetable goes stale, and a CloudWatch alarm emails the budget address (via an "alerts" SNS topic; confirm its subscription email once). A second alarm fires if the job hasn't run at all for a day.
- **If the timetable is out of date:** the download can still succeed with an old feed, so the job also emails the alerts topic when Irish Rail's GTFS has trains for 14 days or fewer, or the NTA hasn't republished it (`feed_start_date` in `feed_info.txt`) for 14 days. It normally covers most of a year and is republished every few days. Like the NIR reminder, it repeats daily until fixed.
- **Matching:** GTFS has no Irish Rail station codes, so stops are matched to ours by position (within 600 m), else by name within 3 km. Its trips carry the live API's train codes (E200…), so trains already shown live aren't listed twice. The GTFS calendar's exceptions (e.g. Christmas) and trains past midnight are handled.
- **Locally:** `npm run timetable:local` builds the same files into `packages/web/.timetable/` (git-ignored); the Vite dev server serves them at `/timetable/...`. They're never part of a build.
- **Next:** GTFS-Realtime (needs a free NTA key) could add cancellations and act as a second live source.

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
- **Untracked trains look on time:** every train says `Status=No Information` until it starts its run, but some (often Cork commuter trains) keep saying it while running, with no last location, `Late=0` and expected = scheduled: the timetable, not a tracked time. Once a train's start time is more than 2 minutes past (compared with the answer's own `Querytime`, not the device clock), departures mark it `untracked` and the app shows it hollow with a "Not tracked" tag and its timetable time, no lateness.

**Stop lists**
- **Cancelled stops** (`LocationType=C`) are skipped, so a train that starts partway still matches its line.
- **Missing stations:** some stop lists leave out newer stations, e.g. Woodbrook.

## Maintenance

- **After a timetable or network change** (e.g. DART+ extensions), run `npm run verify-line`. DART+ will move the Maynooth, Kildare and Drogheda routes to the DART over the coming years.
- **After `update-stations`,** run `npm run alexa:model` and `ask deploy`, so the voice model matches.
- **Extra station names** for voice and search go in `EXTRA_ALIASES` in `core/src/stations.ts`.
