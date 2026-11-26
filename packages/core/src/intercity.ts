/**
 * Intercity routes. Each route's paths run from its hub (Dublin, or Limerick Junction, Cork, Ballybrophy and
 * Limerick for the cross-country lines) outwards, so with the line helpers "Northbound" means away from the hub.
 * Stops are the stations Intercity trains call at, traced from live trains' stop lists (Nov 2026): in Dublin
 * they skip most commuter stations, so those aren't on these paths. Every code answers in the departures feed.
 */
import { directionBetween, type Line } from './line';
import type { Departure } from './types';

export type IntercityRouteId = 'corkKerry' | 'galwayMayo' | 'limerick' | 'waterford' | 'sligo' | 'rosslare';

export interface IntercityRoute {
  id: IntercityRouteId;
  line: Line;
}

// Heuston to Limerick Junction: shared by the Cork, Limerick and Kerry trains.
const SOUTH_WEST_MAIN = ['HSTON', 'KDARE', 'PTRTN', 'PTLSE', 'BBRHY', 'TPMOR', 'THRLS', 'LMRKJ'];
const KERRY = ['BTEER', 'MLSRT', 'RMORE', 'KLRNY', 'FFORE', 'TRLEE'];
const GALWAY_MAIN = ['HSTON', 'KDARE', 'PTRTN', 'TMORE', 'CLARA', 'ATLNE'];
const MAYO = ['RSCMN', 'CSREA', 'BYHNS', 'CLMRS', 'MNLAJ'];

const route = (id: IntercityRouteId, paths: string[][]): IntercityRoute => ({
  id,
  line: { paths, termini: { Northbound: paths.map((p) => p.at(-1)!), Southbound: paths.map((p) => p[0]!) } },
});

export const INTERCITY_ROUTES: IntercityRoute[] = [
  route('corkKerry', [
    [...SOUTH_WEST_MAIN, 'CVILL', 'MLLOW', 'CORK'],
    [...SOUTH_WEST_MAIN, 'CVILL', 'MLLOW', ...KERRY],
    // Cork–Tralee trains, via Mallow.
    ['CORK', 'MLLOW', ...KERRY],
  ]),
  route('galwayMayo', [
    [...GALWAY_MAIN, 'BSLOE', 'WLAWN', 'ATMON', 'ATHRY', 'ORNMR', 'GALWY'],
    [...GALWAY_MAIN, ...MAYO, 'CLBAR', 'WPORT'],
    [...GALWAY_MAIN, ...MAYO, 'FXFRD', 'BALNA'],
  ]),
  route('limerick', [
    [...SOUTH_WEST_MAIN, 'LMRCK'],
    // The Nenagh line, Ballybrophy to Limerick.
    ['BBRHY', 'RCREA', 'CJRDN', 'NNAGH', 'BHILL', 'CCONL', 'LMRCK'],
    // Limerick to Ennis and on up the Western Rail Corridor to Athenry and Galway.
    ['LMRCK', 'SXMBR', 'ENNIS', 'GORT', 'ARHAN', 'CRGHW', 'ATHRY', 'ORNMR', 'GALWY'],
    // Ennis–Limerick Junction trains.
    ['LMRKJ', 'LMRCK', 'SXMBR', 'ENNIS'],
  ]),
  route('waterford', [
    ['HSTON', 'KDARE', 'ATHY', 'CRLOW', 'MNEBG', 'KKNNY', 'THTWN', 'WFORD'],
    // Limerick Junction to Waterford.
    ['LMRKJ', 'TIPRY', 'CAHIR', 'CLMEL', 'CKOSR', 'WFORD'],
  ]),
  route('sligo', [
    ['CNLLY', 'DCDRA', 'BBRDG', 'MYNTH', 'KCOCK', 'ENFLD', 'MLGAR', 'ETOWN', 'LFORD', 'DRMOD', 'CKOSH', 'BOYLE', 'BMOTE', 'COLNY', 'SLIGO'],
  ]),
  route('rosslare', [
    ['CNLLY', 'TARA', 'PERSE', 'DLERY', 'BRAY', 'GSTNS', 'KCOOL', 'WLOW', 'RDRUM', 'ARKLW', 'GOREY', 'ECRTY', 'WXFRD', 'RLSTD', 'RLEPT'],
  ]),
];

/** Every Intercity station, each once, in route order. */
export const INTERCITY_STATION_CODES: string[] = [...new Set(INTERCITY_ROUTES.flatMap((r) => r.line.paths.flat()))];

const onRoute = (route: IntercityRoute, code: string) => route.line.paths.some((p) => p.includes(code));

/**
 * Which route a departure from `stationCode` is on, and whether it's heading away from the route's hub.
 * Routes share track (Heuston to Limerick Junction carries Cork, Kerry and Limerick trains), so the route
 * that also serves the train's origin wins: a Limerick–Heuston train at Thurles is a Limerick train.
 * Undefined when no route serves both this station and the destination.
 */
export function intercityHeading(stationCode: string, departure: Departure): { route: IntercityRoute; outbound: boolean } | undefined {
  const destination = departure.destinationCode;
  if (!destination) return undefined;
  const candidates = INTERCITY_ROUTES.filter((r) => directionBetween(stationCode, destination, r.line));
  const origin = departure.originCode;
  const route = (origin && candidates.find((r) => onRoute(r, origin))) || candidates[0];
  return route && { route, outbound: directionBetween(stationCode, destination, route.line) === 'Northbound' };
}
