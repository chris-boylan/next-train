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
import { directionBetween, type Line } from './line';
import type { Service, ServiceId } from './services';
import { type ScheduledDeparture, scheduledMatches } from './timetable';
import type { Departure, Direction } from './types';

export interface StationLine {
  /** `main` for a service's only line, else the route's id. */
  id: 'main' | CommuterRouteId | IntercityRouteId;
  line: Line;
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

/** The lines a station page shows, in route order. Always at least one. */
export function stationLines(service: Service, code: string): StationLine[] {
  const routes = service.id === 'commuter' ? COMMUTER_ROUTES : service.id === 'intercity' ? INTERCITY_ROUTES : [];
  const here = routes.filter((r) => onPath(r.line, code));
  return here.length ? here.map((r) => ({ id: r.id, line: r.line })) : [{ id: 'main', line: service.line }];
}

const compass = (direction: string): Direction | undefined =>
  direction === 'Northbound' || direction === 'Southbound' ? direction : undefined;
const track = (outbound: boolean): Direction => (outbound ? 'Northbound' : 'Southbound');

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
    if (own) return { lineId: own.id, direction: track(heading.outbound) };
    const outbound =
      service.id === 'intercity' ? false : heading ? isCityStation(code) : !(d.destinationCode && isCityStation(d.destinationCode));
    return { lineId: lines[0]!.id, direction: track(outbound), fallback: true };
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
