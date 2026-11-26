# Plan: Intercity service

Status: **built on `feature/intercity`** (2026-11-26): core routes, service, API, Irish names, station boards
and the `RoutesMap` map are done and tested. Open: the "All routes" overview is an automatic tree drawing for now
(a geographic map with every name doesn't fit a phone's width; see README "InterCity"), and the Lisburn/Lurgan/Moira
Enterprise check below.

What changed from the plan: all InterCity trains (Rosslare, Sligo and the cross-country locals too) have "A"
codes, so matching is simply "A" code and not Enterprise. Boards group by route and next station, and always name
the destinations. Manulla Junction joins Curragh as a station with no published Irish name.

## Goal

Add a fifth service, **Intercity**, covering the ~70 stations no service has today, so every Irish Rail station
has a service tile, a map and a station page. Built the same way as Dublin Commuter (`core/src/commuter.ts`,
`web/src/CommuterMap.tsx`, `web/src/StationBoard.tsx`): routes with their own colours, one geographic map of all
routes plus a "By route" view, and station boards grouped by route and direction.

Out of scope: Alexa (it is DART-only by design; see "Later").

## Where we are

- `main` has DART, Enterprise, Cork Commuter and Dublin Commuter (86 stations). 100 tests pass. Not deployed yet.
- Stations not in any service already have live times through the all-stations board (`StationBoard mode="all"`).
- `web/src/network.data.ts` (from `build-network`) has the track topology for most Intercity lines. Some lines have
  **no connections yet** because no train was running when it sampled (see the routes table).

## Routes

Paths run city end first, like commuter routes, so "Northbound" means outbound. Where a route shares track with a
commuter route (Heuston–Kildare–Portlaoise, Connolly–Maynooth, Connolly–Gorey), the Intercity path includes those
stations, so boards and maps show the whole run.

| Route | Path (city first), branches | In network.data? |
|---|---|---|
| Cork & Kerry | HSTON … KDARE, PTRTN, PTLSE, BBRHY, TPMOR, THRLS, LMRKJ, CVILL, MLLOW, CORK; branch MLLOW, BTEER, MLSTR, RMORE, KLRNY, FFORE, TRLEE | Yes (MLLOW–CORK is on the Cork Commuter line too) |
| Galway & Mayo | HSTON … KDARE, MONVN, PTRTN, TMORE, CLARA, ATLNE, BSLOE, WLAWN, ATMON, ATHRY, ORNMR, GALWY; branch ATLNE, RSCMN, CSREA, BYHNS, CLMRS, MNLAJ, CLBAR, WPORT; branch MNLAJ, FXFRD, BALNA | Yes |
| Sligo | CNLLY … MYNTH, KCOCK, ENFLD, MLGAR, ETOWN, LFORD, DRMOD, CKOSH, BOYLE, BMOTE, COLNY, SLIGO | Yes |
| Limerick & Ennis | HSTON … LMRKJ, LMRCK; LMRCK, SXMBR, ENNIS, GORT, ARHAN, CRGHW, ATHRY (Western Rail Corridor); BBRHY, RCREA, CJRDN, NNAGH, BHILL, CCONL, LMRCK (Nenagh line) | Partly: Ennis line yes; **Gort–Athenry and Nenagh line missing** |
| Waterford | HSTON … KDARE, ATHY, CRLOW, MNEBG, KKNNY, THTWN, WFORD; LMRKJ, TIPRY, CAHIR, CLMEL, CKOSR, WFORD | Partly: Kilkenny line yes; **Limerick Junction–Waterford missing** |
| Rosslare | CNLLY … GOREY, ECRTY, WXFRD, RLSTD, RLEPT | Yes |

Codes above are from `network.data.ts`; confirm the unfamiliar ones (e.g. TMORE, TPMOR, CRLOW, MLSTR, RMORE,
KLRNY, CSREA, BYHNS, CLBAR, FXFRD, CKOSH, BOYLE, BMOTE, ETOWN, DRMOD) against `getAllStationsXML` before using
them. The route list and grouping are a proposal; confirm with the user before building.

Data oddities to sort out while building:
- `PTRTN–TMORE` and `LMRCK–THRLS` appear as direct edges (probably trains whose movement lists skip a station).
  Paths are hand-defined like the commuter routes, so don't copy edges blindly; cross-check with live movements.
- **Campile, Ballycullane, Wellingtonbridge, Bridgetown** (Rosslare–Waterford) are in the API's station list, but
  that line has had no passenger trains since 2010. Leave them out unless a live train shows up.
- **Lisburn, Lurgan, Moira** are on the network but not in the Enterprise station list. Check which Enterprise
  trains stop there and add them to Enterprise if so (separate small fix, not Intercity).
- Fill the missing lines by running `npm run build-network -w @dart-times/core` at a few times of day (it keeps
  earlier results), or hand-define those paths from the timetable.

## How to recognise Intercity trains

The API only says "Train". Intercity trains use **"A" train codes** (commuter matching already excludes them), so
the starting point is `Traintype !== 'DART' && Traincode starts with 'A' && !isEnterprise(raw)`. Check live:
- Are there Intercity trains without an "A" code (e.g. Rosslare, Sligo, Limerick–Ennis, Nenagh, Western Rail
  Corridor locals)? Record their codes from live boards at Limerick, Athenry, Wexford and Mullingar.
- Cork Commuter excludes "A" codes, so Cork–Dublin trains already fall to Intercity. Check Mallow and Cork boards.
- At shared stations (Heuston, Connolly, Kildare, Portlaoise, Maynooth, Gorey), each train should match exactly one
  of commuter or Intercity. Add a test with a recorded mixed board.

Record new XML fixtures from the real API into `packages/core/test/fixtures/` (e.g. a Heuston board, an Athlone
board, a Limerick board, and movements for one train per route). Tests must not hit the network.

## Build steps

1. **Core: routes.** `core/src/intercity.ts`: `IntercityRouteId`, `INTERCITY_ROUTES` (`{ id, line, outer }`),
   `INTERCITY_STATION_CODES`, and `intercityHeading(stationCode, departure)` mirroring `commuterHeading`:
   1. a route serving both stations, with `directionBetween`;
   2. otherwise the destination's route, inbound when the destination is a city station (Heuston, Connolly).
2. **Core: stations.** `core/src/stations.intercity.data.ts` with `StationRecord`s (codes, names, lat/lon from the
   API), `INTERCITY_ONLY_STATIONS` in `stations.ts`, included in `ALL_STATIONS`.
3. **Core: Irish names.** Add every new station to `stations.ga.ts`, with a `short` form where the name is long.
   The `stations.test.ts` "every station has an Irish name" test lists exceptions (only `CURAH` today); keep it short.
4. **Core: service.** `services.ts`: add `'intercity'` to `ServiceId`, `SERVICES`, `isServiceId`; `matches` as above;
   line = every route's paths flattened, empty termini (as commuter).
5. **API.** `api/src/handler.ts` accepts `service=intercity`; add handler tests like the commuter ones.
6. **Web: picker and theme.** `i18n.tsx`: `serviceNames.intercity` ('Intercity' / 'Idirchathrach'), route names in
   both languages. `ServicePicker.tsx` tile; `data-service="intercity"` colours and `.service-tile--intercity` in
   `styles.css`.
7. **Web: routes.** `web/src/intercityRoutes.ts` like `commuterRoutes.ts` (colours, edges, `routeColoursOf` for
   striped shared track). Pick colours that read on both themes and differ from the commuter ones.
8. **Web: map.** `intercitySchematic(row)` like `commuterSchematic.ts`: hand-placed and geography-inspired (Dublin on
   the east, lines fanning west and south-west: Sligo north-west, Galway/Mayo west, Limerick/Ennis and Cork/Kerry
   south-west, Waterford south, Rosslare down the coast), with a wider row in Irish. It is much bigger than the
   commuter map: probably only city ends and junctions labelled at first, or a TreeMap-per-route only. Decide after
   a first render. `IntercityMap.tsx` with All routes / By route, like `CommuterMap.tsx`.
9. **Web: station pages.** `App.tsx` and `StationPicker.tsx` route Intercity stations to `StationBoard` with a new
   `mode="intercity"` (generalise the commuter grouping to take a heading function and route list).
10. **Docs.** README (services, map table, branch table) and CLAUDE.md (lines vs services).

## Verify

- `npm test`, `npm run typecheck`, `npm run build:web`.
- Live click-through (local `npm run dev:api` + `npm run dev:web`): Heuston, Connolly, Athlone, Limerick Junction,
  Limerick, Mallow, Waterford, Wexford, Sligo boards group correctly in English and Irish.
- Map checks with headless Chrome, in English and Irish: no overlapping station names, nothing off screen, every dot
  tappable. The screenshot tool used before was deleted; reinstall with
  `npm i puppeteer-core@23.10.4` in a temp folder and point it at `/Applications/Google Chrome.app`.

## Lessons from the commuter work

- Irish names wrap: put `Caps` inside one `<span>` in flex labels, give labels per-point `labelWidth`, and use a
  bigger row spacing in Irish (commuter uses 50 vs 34).
- Shared track: pass a list of colours from `colourOf` and `PositionedMap` draws side-by-side stripes.
- `MapHits` makes dots tappable; any new map renderer needs it.
- Heading rules need a "city destination → this station's route, inbound" case (Malahide → Grand Canal Dock).
- The repo has no Prettier config. Don't run Prettier over existing files: its defaults rewrap them.
- Write helper scripts to files (in the job temp dir) instead of long bash heredocs; `tsx -e` can't use top-level
  await.

## Later

- Deploy (`npm run deploy`, needs AWS credentials; only when asked).
- Alexa: still DART-only (`alexa/scripts/build-model.ts` uses `DART_STATIONS`). Covering every service needs a
  bigger station slot and a way to ask by service or route. The invocation name is also still undecided.
- Confirm Cork's Cobh branch against a live train.
