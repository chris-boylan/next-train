/**
 * Dublin commuter routes. Each route's paths run city end first, so with the line helpers "Northbound"
 * means outbound (away from Dublin) and "Southbound" inbound. Traced from track connections recorded
 * from live trains (Nov 2026); every station's code answers in the departures feed.
 */
import { directionBetween, type Line } from './line';
import type { Departure } from './types';

export type CommuterRouteId = 'northern' | 'western' | 'southWestern' | 'southEastern';

export interface CommuterRoute {
  id: CommuterRouteId;
  line: Line;
  /** Where outbound trains finish, for "towards …" headings. */
  outer: string[];
}

const SOUTH_WESTERN_MAIN = ['CHORC', 'CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE', 'MONVN', 'PTRTN', 'PTLSE'];
const WESTERN_TRUNK = ['CNLLY', 'DCDRA', 'BBRDG', 'PELTN', 'ASHTN', 'PHNPK', 'CNOCK', 'CMINE', 'CLSLA'];
const NORTHERN_MAIN = ['CNLLY', 'CTARF', 'KLSTR', 'HTOWN', 'RAHNY', 'KBRCK', 'HWTHJ', 'GRGRD', 'PMNCK', 'MHIDE', 'DBATE', 'RLUSK', 'SKRES', 'BBRGN', 'GSTON', 'LTOWN', 'DGHDA', 'DDALK'];
/** Many Northern, Western and South Western trains run through Connolly to Tara Street, Pearse and Grand Canal Dock. */
const CITY_THROUGH = ['GCDK', 'PERSE', 'TARA'];

export const COMMUTER_ROUTES: CommuterRoute[] = [
  {
    id: 'northern',
    line: {
      // From Connolly, and through from Grand Canal Dock (live trains, Nov 2026: Drogheda–Grand Canal Dock).
      paths: [NORTHERN_MAIN, [...CITY_THROUGH, ...NORTHERN_MAIN]],
      termini: { Northbound: ['DGHDA', 'DDALK'], Southbound: ['CNLLY', 'GCDK'] },
    },
    outer: ['DGHDA', 'DDALK'],
  },
  {
    id: 'western',
    line: {
      paths: [
        [...WESTERN_TRUNK, 'LXCON', 'LXLSA', 'MYNTH'],
        // Through from Grand Canal Dock (live trains: Maynooth–Grand Canal Dock).
        [...CITY_THROUGH, ...WESTERN_TRUNK, 'LXCON', 'LXLSA', 'MYNTH'],
        [...WESTERN_TRUNK, 'HAFLD', 'DBYNE', 'M3WAY'],
        ['CNLLY', 'DCDRA', 'BBRDG', 'DCKLS'],
      ],
      termini: { Northbound: ['MYNTH', 'M3WAY'], Southbound: ['CNLLY', 'DCKLS', 'GCDK'] },
    },
    outer: ['MYNTH', 'M3WAY'],
  },
  {
    id: 'southWestern',
    line: {
      // From Heuston, and from Grand Canal Dock through the city and the Phoenix Park tunnel.
      paths: [
        ['HSTON', ...SOUTH_WESTERN_MAIN],
        ['GCDK', 'PERSE', 'TARA', 'CNLLY', 'DCDRA', ...SOUTH_WESTERN_MAIN],
      ],
      termini: { Northbound: ['HZLCH', 'NBRGE', 'KDARE', 'PTLSE'], Southbound: ['HSTON', 'GCDK'] },
    },
    outer: ['KDARE', 'PTLSE'],
  },
  {
    id: 'southEastern',
    line: {
      paths: [['CNLLY', 'TARA', 'PERSE', 'GCDK', 'LDWNE', 'SMONT', 'SIDNY', 'BTSTN', 'BROCK', 'SEAPT', 'SHILL', 'DLERY', 'SCOVE', 'GLGRY', 'DLKEY', 'KILNY', 'SKILL', 'WBROK', 'BRAY', 'GSTNS', 'KCOOL', 'WLOW', 'RDRUM', 'ARKLW', 'GOREY']],
      termini: { Northbound: ['GOREY'], Southbound: ['CNLLY'] },
    },
    outer: ['GOREY'],
  },
];

/** Every commuter station, each once, in route order. */
export const COMMUTER_STATION_CODES: string[] = [...new Set(COMMUTER_ROUTES.flatMap((r) => r.line.paths.flat()))];

/** City-centre stations: a train heading to one of these is going into Dublin. */
const CITY = new Set(['CNLLY', 'HSTON', 'TARA', 'PERSE', 'GCDK', 'DCKLS']);

export function isCityStation(code: string): boolean {
  return CITY.has(code);
}

const onRoute = (route: CommuterRoute, code: string) => route.line.paths.some((p) => p.includes(code));

/**
 * Which route a departure from `stationCode` is on, and whether it's heading out of Dublin:
 * 1. a route serving both this station and the destination (routes share track through the city, so the one
 *    that also serves the train's origin wins: a Drogheda–Grand Canal Dock train at Connolly is a Northern one);
 * 2. a train heading into the city centre is on this station's route, even if its city terminus is on
 *    another route too (Malahide to Grand Canal Dock is a Northern train heading in);
 * 3. a train running through the city to another route (Pearse to Drogheda) is on the destination's route.
 * Undefined when the destination isn't on any commuter route (e.g. a train to Longford), so callers can
 * group it by its own direction.
 */
export function commuterHeading(stationCode: string, departure: Departure): { route: CommuterRoute; outbound: boolean } | undefined {
  const destination = departure.destinationCode;
  if (!destination) return undefined;
  const serving = COMMUTER_ROUTES.filter((r) => onRoute(r, destination));
  const candidates = serving.filter((r) => onRoute(r, stationCode) && directionBetween(stationCode, destination, r.line));
  const origin = departure.originCode;
  const both = (origin && candidates.find((r) => onRoute(r, origin))) || candidates[0];
  if (both) return { route: both, outbound: directionBetween(stationCode, destination, both.line) === 'Northbound' };
  const here = COMMUTER_ROUTES.find((r) => onRoute(r, stationCode));
  if (here && CITY.has(destination)) return { route: here, outbound: false };
  const route = serving[0];
  return route && { route, outbound: !CITY.has(destination) };
}
