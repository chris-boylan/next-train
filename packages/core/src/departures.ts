import type { IrishRailClient, RawStationData } from './irishRailClient';
import { callsAt, type Line } from './line';
import { SERVICES, type ServiceId } from './services';
import { findStationByName } from './stations';
import type { Departure, Direction, TrainCategory } from './types';

export interface DepartureOptions {
  direction?: Direction;
  limit?: number;
  /** How far ahead to look, 5–90 minutes. */
  withinMins?: number;
  /** Which service's trains to keep; defaults to the DART. */
  service?: ServiceId;
  /** Keep every train calling at the station, whatever the service. */
  includeTrains?: boolean;
}

export function parseDirection(input: string | null | undefined): Direction | undefined {
  const value = input?.trim().toLowerCase();
  if (!value) return undefined;
  if (['n', 'north', 'northbound', 'northern'].includes(value)) return 'Northbound';
  if (['s', 'south', 'southbound', 'southern'].includes(value)) return 'Southbound';
  return undefined;
}

/**
 * The API only says "DART" or "Train". The Enterprise is the only service to or from Belfast; among
 * the rest, InterCity train codes start with "A" (observed across Cork, Galway, Limerick, Rosslare,
 * Sligo, Tralee and Waterford services, Nov 2026, but not documented by Irish Rail), and everything
 * else is treated as commuter.
 */
export function trainCategory(raw: RawStationData): TrainCategory {
  if (raw.Traintype === 'DART') return 'dart';
  if (SERVICES.enterprise.matches(raw)) return 'enterprise';
  return raw.Traincode.trim().startsWith('A') ? 'intercity' : 'commuter';
}

function terminatesHere(raw: RawStationData): boolean {
  return raw.Locationtype === 'D' || raw.Destination === raw.Stationfullname;
}

function toInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Turns raw station data into departures. Trains that terminate at the station
 * are dropped, since nobody can board them. Sorting uses `Duein` (minutes from
 * now) rather than clock times, so trains either side of midnight stay in order.
 */
export function toDepartures(raw: RawStationData[], options: DepartureOptions = {}): Departure[] {
  const departures = raw
    .filter((r) => !terminatesHere(r))
    .filter((r) => options.includeTrains || SERVICES[options.service ?? 'dart'].matches(r))
    .filter((r) => !options.direction || r.Direction === options.direction)
    .map(
      (r): Departure => ({
        trainCode: r.Traincode,
        origin: r.Origin,
        destination: r.Destination,
        originCode: findStationByName(r.Origin)?.code,
        destinationCode: findStationByName(r.Destination)?.code,
        direction: r.Direction,
        dueInMins: toInt(r.Duein),
        expectedDepart: r.Expdepart,
        scheduledDepart: r.Schdepart,
        lateMins: toInt(r.Late),
        trainType: r.Traintype,
        category: trainCategory(r),
        lastLocation: r.Lastlocation,
      }),
    )
    .sort((a, b) => a.dueInMins - b.dueInMins);
  return options.limit === undefined ? departures : departures.slice(0, options.limit);
}

export async function getDepartures(
  client: IrishRailClient,
  stationCode: string,
  options: DepartureOptions = {},
): Promise<Departure[]> {
  const raw = await client.getStationData(stationCode, options.withinMins ?? 90);
  return toDepartures(raw, options);
}

/**
 * Departures that will take you from `from` to `goingTo`: the train must be heading the right way and
 * not terminate before it (e.g. a Bray train doesn't help if you're going to Greystones, and a Malahide
 * train doesn't stop at Sutton).
 */
export function departuresGoingTo(departures: Departure[], from: string, goingTo: string, line?: Line): Departure[] {
  return departures.filter((d) => !!d.destinationCode && callsAt(from, d.destinationCode, goingTo, line));
}
