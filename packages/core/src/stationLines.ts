// The lines a station page shows, and which line and track each train goes on. Most stations have one line
// (two tracks: Northbound and Southbound along it). On the Dublin Commuter and InterCity a station can be on
// several routes (Connolly is on all four Commuter routes, Kildare on four InterCity ones), so each route is a
// line of its own, chosen with chips on the page. Their paths run from the hub outwards, so there "Northbound"
// is outbound (away from Dublin, or a cross-country line's hub) and "Southbound" inbound.
//
// Every live train is placed on some line, so none can silently drop off the page; timetabled ones are placed
// when they belong to the page's service.
import { COMMUTER_ROUTES, type CommuterRouteId, commuterHeading, isCityStation } from './commuter';
import { INTERCITY_ROUTES, type IntercityRouteId, intercityHeading } from './intercity';
import { adjacentStations, directionBetween, type Line } from './line';
import { findStationByCode } from './stations';
import type { Service, ServiceId } from './services';
import { type ScheduledDeparture, scheduledMatches } from './timetable';
import type { Departure, Direction } from './types';

export interface StationLine {
  /** `main` for a service's only line, else the route's id. */
  id: 'main' | 'all' | CommuterRouteId | IntercityRouteId;
  /** The line as this station's page draws it: on Commuter and InterCity routes, turned so Northbound (the up
   *  track) heads north where the line clearly runs north–south (see `orientAt`). */
  line: Line;
  /** True when the route's outbound direction is drawn down (Southbound) here, e.g. Carlow towards Waterford. */
  outboundDown?: boolean;
}

export interface Placement {
  lineId: StationLine['id'];
  direction: Direction;
  /** True when the train's route couldn't be told and it was put on the station's first line. */
  fallback?: boolean;
}

/** Services whose Northbound/Southbound are compass directions; elsewhere tracks are named by where trains go. */
export const hasCompassDirections = (service: ServiceId) => service !== 'commuter' && service !== 'intercity';

const onPath = (line: Line, code: string) => line.paths.some((p) => p.includes(code));

/** Rough km from `a` to `b`: north (+) and east (+). */
function offset(a: string, b: string): { n: number; e: number } | undefined {
  const from = findStationByCode(a);
  const to = findStationByCode(b);
  if (!from || !to) return undefined;
  return { n: (to.lat - from.lat) * 111, e: (to.lon - from.lon) * 111 * Math.cos((from.lat * Math.PI) / 180) };
}

/** Which way a north–south reading of `diff` points, if it's north–south enough: at least `ratio` as much north
 *  or south as east or west. */
function southward(diff: { n: number; e: number } | undefined, ratio: number): boolean | undefined {
  if (!diff || Math.abs(diff.n) < Math.abs(diff.e) * ratio) return undefined;
  return diff.n < 0;
}

/**
 * A route as one station's page draws it. Route paths run from the hub outwards, so "Northbound" is outbound;
 * that's upside down where a line runs south (Carlow: Waterford up, Heuston down). Each path through the station
 * is turned round so the up track heads north: by the next stations either side where they're clearly north and
 * south of each other, else (a stretch running east–west, like Seapoint on the coast) by where the whole path
 * runs, so a line doesn't flip from one station to the next. Only paths running almost due east–west (Dublin to
 * Galway) keep outbound up. Termini move with their paths.
 */
export function orientAt(line: Line, code: string): { line: Line; outboundDown: boolean } {
  let firstFlipped: boolean | undefined;
  // Which side each neighbour ended up on, so later paths through the same neighbour agree (at Limerick
  // Junction, Heuston–Limerick and Limerick Junction–Ennis both leave towards Limerick: one track for both).
  const side = new Map<string, 'out' | 'in'>();
  const paths = line.paths.map((path) => {
    const i = path.indexOf(code);
    if (i < 0) return path;
    const before = path[i - 1];
    const after = path[i + 1];
    // Outbound side minus inbound side; at an end of the path, the one neighbour against the station itself.
    const out = after ? offset(code, after) : undefined;
    const back = before ? offset(code, before) : undefined;
    const diff = after && before ? out && back && { n: out.n - back.n, e: out.e - back.e } : after ? out : back && { n: -back.n, e: -back.e };
    const whole = offset(path[0]!, path.at(-1)!);
    const own = southward(diff, 0.5) ?? southward(whole, 0.25) ?? false;
    // Drawn as "out" (Northbound, up) unless flipped: a neighbour already placed decides, the next stop first.
    const known = (after && side.get(after)) ?? (before && side.get(before) && (side.get(before) === 'out' ? 'in' : 'out'));
    const flip = known ? known === 'in' : own;
    if (after && !side.has(after)) side.set(after, flip ? 'in' : 'out');
    if (before && !side.has(before)) side.set(before, flip ? 'out' : 'in');
    firstFlipped ??= flip;
    return flip ? [...path].reverse() : path;
  });
  if (!firstFlipped) return { line, outboundDown: false };
  const oriented: Line = { paths, termini: { Northbound: [], Southbound: [] } };
  for (const direction of ['Northbound', 'Southbound'] as const) {
    for (const end of line.termini[direction]) {
      const now = directionBetween(code, end, oriented) ?? direction;
      if (!oriented.termini[now].includes(end)) oriented.termini[now].push(end);
    }
  }
  return { line: oriented, outboundDown: true };
}

/** The lines a station page shows, in route order. Always at least one. */
export function stationLines(service: Service, code: string): StationLine[] {
  const routes = service.id === 'commuter' ? COMMUTER_ROUTES : service.id === 'intercity' ? INTERCITY_ROUTES : [];
  const here = routes.filter((r) => onPath(r.line, code));
  if (!here.length) return [{ id: 'main', line: service.line }];
  return here.map((r) => {
    const { line, outboundDown } = orientAt(r.line, code);
    return { id: r.id, line, ...(outboundDown && { outboundDown }) };
  });
}

const compass = (direction: string): Direction | undefined =>
  direction === 'Northbound' || direction === 'Southbound' ? direction : undefined;
const track = (outbound: boolean): Direction => (outbound ? 'Northbound' : 'Southbound');
/** The track for an outbound or inbound train on a station line, which may draw outbound down. */
const trackOn = (line: StationLine | undefined, outbound: boolean) => track(outbound !== !!line?.outboundDown);

/**
 * Which line and track a live train goes on. Commuter and InterCity trains go on their route
 * (`commuterHeading`, `intercityHeading`). One whose route can't be told goes on the station's first line:
 * on the Commuter, a train for another route runs through the city to it (Maynooth to Dun Laoghaire), so it's
 * inbound (outbound from a city station), and one for a destination on no route (Longford) is outbound unless
 * it's heading into the city; on InterCity, it's taken to be heading for the hub. Elsewhere the direction comes
 * from the line layout, else the API's. Undefined only when neither says (a single-line service whose API
 * direction reads "To Cork" for a destination off the line).
 */
export function placeDeparture(service: Service, code: string, lines: StationLine[], d: Departure): Placement | undefined {
  if (service.id === 'commuter' || service.id === 'intercity') {
    const heading = service.id === 'commuter' ? commuterHeading(code, d) : intercityHeading(code, d);
    const own = heading && lines.find((l) => l.id === heading.route.id);
    if (own) {
      // Along the line as this page draws it, where the destination is on it; else outbound or inbound.
      const along = d.destinationCode && d.destinationCode !== code ? directionBetween(code, d.destinationCode, own.line) : undefined;
      return { lineId: own.id, direction: along ?? trackOn(own, heading.outbound) };
    }
    const outbound =
      service.id === 'intercity' ? false : heading ? isCityStation(code) : !(d.destinationCode && isCityStation(d.destinationCode));
    return { lineId: lines[0]!.id, direction: trackOn(lines[0], outbound), fallback: true };
  }
  const line = lines[0]!;
  const direction = (d.destinationCode && directionBetween(code, d.destinationCode, line.line)) || compass(d.direction);
  return direction && { lineId: line.id, direction };
}

/**
 * Which line and track a timetabled train goes on, if it belongs on this page: the service's own trains (an NI
 * Railways page also lists the Enterprise), placed as live ones are. The timetable has no origin, so a train on
 * shared track goes on the first route that reaches its destination.
 */
export function placeTimetabled(service: Service, code: string, lines: StationLine[], d: ScheduledDeparture): Placement | undefined {
  const services: ServiceId[] = service.id === 'nir' ? ['nir', 'enterprise'] : [service.id];
  if (!d.destinationCode || !services.some((s) => scheduledMatches(s, d))) return undefined;
  if (service.id === 'commuter' || service.id === 'intercity') {
    // Shaped like a live departure for the heading functions; they only read the destination and origin.
    return placeDeparture(service, code, lines, { destinationCode: d.destinationCode, direction: '' } as Departure);
  }
  const line = lines[0]!;
  const direction = directionBetween(code, d.destinationCode, line.line);
  return direction && { lineId: line.id, direction };
}

const opposite = (d: Direction): Direction => (d === 'Northbound' ? 'Southbound' : 'Northbound');

/** Every route through a hub on one pair of tracks (the station page's "All"), and which routes were turned round. */
export interface AllRoutesLine extends StationLine {
  id: 'all';
  /** Routes whose tracks are swapped here to match the first route's: their Northbound is this line's Southbound. */
  flipped: ReadonlySet<StationLine['id']>;
}

/**
 * All of a station's routes as one line, for a hub where several meet (Kildare: Cork & Kerry, Galway & Mayo,
 * Limerick, Waterford). Each route is drawn north-up on its own (see `orientAt`), but a route running east–west
 * keeps "outbound is up", so two routes can disagree about which side a shared neighbour is on (Galway & Mayo has
 * Heuston down at Kildare, Cork & Kerry has it up). Each route is lined up with the first by a neighbour they
 * share, so every train goes on the side its next station really is. Undefined with only one route.
 */
export function allRoutesLine(lines: StationLine[], code: string): AllRoutesLine | undefined {
  if (lines.length < 2) return undefined;
  const first = adjacentStations(code, lines[0]!.line);
  const flipped = new Set<StationLine['id']>();
  for (const l of lines.slice(1)) {
    const own = adjacentStations(code, l.line);
    const disagrees =
      own.north.some((n) => first.south.includes(n) && !first.north.includes(n)) ||
      own.south.some((n) => first.north.includes(n) && !first.south.includes(n));
    if (disagrees) flipped.add(l.id);
  }
  const paths: string[][] = [];
  const termini: Line['termini'] = { Northbound: [], Southbound: [] };
  for (const l of lines) {
    const flip = flipped.has(l.id);
    for (const path of l.line.paths) paths.push(flip ? [...path].reverse() : path);
    for (const direction of ['Northbound', 'Southbound'] as const) {
      const to = flip ? opposite(direction) : direction;
      for (const end of l.line.termini[direction]) if (!termini[to].includes(end)) termini[to].push(end);
    }
  }
  return { id: 'all', line: { paths, termini }, flipped };
}

/** A placed train's track on the all-routes line: its own route's track, swapped if that route was turned round. */
export function trackOnAll(all: AllRoutesLine, placement: Placement | undefined): Direction | undefined {
  if (!placement) return undefined;
  return all.flipped.has(placement.lineId) ? opposite(placement.direction) : placement.direction;
}
