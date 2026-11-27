// Scheduled departures from Irish Rail's GTFS timetable (published by the National Transport Authority), for
// trains beyond the live API's 90-minute window. GTFS has no Irish Rail station codes, so its stops are matched
// to ours by position; its trips carry the same train codes as the live API (E200…), so the two can be joined.
import type { Station, TrainCategory } from './types';

/** The GTFS files this needs, as text. */
export interface GtfsFiles {
  stops: string;
  routes: string;
  trips: string;
  stopTimes: string;
  calendar: string;
  calendarDates: string;
}

export interface ScheduledDeparture {
  /** Departure time, `HH:mm` (GTFS can run past 24:00 for trains after midnight; this wraps). */
  time: string;
  /** Minutes after the start of the service day; can exceed 1440 for trains after midnight. */
  minutes: number;
  trainCode: string;
  /** Our station code for where the train ends up, when it's a station we know. */
  destinationCode?: string;
  /** The timetable's name for it, e.g. `Bray (Daly)`. */
  destination: string;
  category: TrainCategory;
}

/** One service day's departures at each of our stations, in time order. */
export interface Timetable {
  /** `YYYYMMDD`, the GTFS service date. */
  date: string;
  byStation: Record<string, ScheduledDeparture[]>;
}

/** Parses GTFS CSV (RFC 4180: quoted fields may hold commas and doubled quotes) into rows keyed by header. */
export function parseCsv(text: string): Record<string, string>[] {
  return [...csvRows(text)];
}

/**
 * The same, one row at a time, so big files (stop_times.txt) are never all in memory as objects: a Lambda
 * with 256 MB would otherwise run short while reading the timetable.
 */
export function* csvRows(text: string): Generator<Record<string, string>> {
  let header: string[] | undefined;
  for (const record of csvRecords(text)) {
    if (!header) header = record.map((h) => h.trim());
    else yield Object.fromEntries(header.map((h, i) => [h, record[i] ?? '']));
  }
}

function* csvRecords(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) yield row;
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f !== '')) yield row;
  }
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Service ids running on `date` (`YYYYMMDD`): the weekly calendar, adjusted by calendar_dates exceptions. */
export function servicesOn(calendar: Record<string, string>[], calendarDates: Record<string, string>[], date: string): Set<string> {
  const day = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8))).getUTCDay();
  const weekday = WEEKDAYS[day]!;
  const active = new Set(calendar.filter((c) => c[weekday] === '1' && c.start_date! <= date && date <= c.end_date!).map((c) => c.service_id!));
  for (const d of calendarDates) {
    if (d.date !== date) continue;
    if (d.exception_type === '1') active.add(d.service_id!);
    else if (d.exception_type === '2') active.delete(d.service_id!);
  }
  return active;
}

/** Distance in metres between two points (equirectangular: plenty for a few hundred metres). */
function metres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.hypot(x, y) * 6_371_000;
}

/** A name for matching: no bracketed official name ("Cork (Kent)"), no "Dublin " prefix, letters only. */
const plainName = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^dublin\s+/, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();

/**
 * GTFS stop id → our station code. A stop matches the nearest of our stations within `maxMetres`; failing
 * that, a station with the same name within 3 km (some stations' coordinates differ by several hundred metres).
 */
export function matchStops(stops: Record<string, string>[], stations: Station[], maxMetres = 600): Map<string, string> {
  const matches = new Map<string, string>();
  for (const stop of stops) {
    const lat = Number(stop.stop_lat);
    const lon = Number(stop.stop_lon);
    let best: { code: string; d: number } | undefined;
    for (const s of stations) {
      const d = metres(lat, lon, s.lat, s.lon);
      if (d <= maxMetres && (!best || d < best.d)) best = { code: s.code, d };
    }
    if (!best) {
      const name = plainName(stop.stop_name ?? '');
      const byName = stations.find(
        (s) => [s.name, s.shortName, s.apiName ?? ''].some((n) => plainName(n) === name) && metres(lat, lon, s.lat, s.lon) <= 3000,
      );
      if (byName) best = { code: byName.code, d: 0 };
    }
    if (best) matches.set(stop.stop_id!, best.code);
  }
  return matches;
}

/** DART, InterCity, Enterprise or Commuter, from the train code (as the live API's categories). */
export function scheduledCategory(trainCode: string, routeId: string): TrainCategory {
  if (routeId.startsWith('DUB-BFT')) return 'enterprise';
  if (trainCode.startsWith('E')) return 'dart';
  if (trainCode.startsWith('A')) return 'intercity';
  return 'commuter';
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
};
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Every departure on `date` at each of `stations`, from the GTFS files. Arrivals at a train's last stop aren't departures. */
export function buildTimetable(files: GtfsFiles, date: string, stations: Station[]): Timetable {
  const stops = parseCsv(files.stops);
  const stopToStation = matchStops(stops, stations);
  const stopName = new Map(stops.map((s) => [s.stop_id!, s.stop_name!]));
  const active = servicesOn(parseCsv(files.calendar), parseCsv(files.calendarDates), date);
  const trips = new Map(parseCsv(files.trips).filter((t) => active.has(t.service_id!)).map((t) => [t.trip_id!, t]));

  // Each running trip's stops, in order.
  const byTrip = new Map<string, Record<string, string>[]>();
  for (const st of csvRows(files.stopTimes)) {
    if (!trips.has(st.trip_id!)) continue;
    const list = byTrip.get(st.trip_id!) ?? [];
    list.push(st);
    byTrip.set(st.trip_id!, list);
  }

  const byStation: Record<string, ScheduledDeparture[]> = {};
  for (const [tripId, stopTimes] of byTrip) {
    const trip = trips.get(tripId)!;
    stopTimes.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    const last = stopTimes.at(-1)!;
    const trainCode = (trip.trip_short_name ?? '').trim();
    const destinationCode = stopToStation.get(last.stop_id!);
    const destination = stopName.get(last.stop_id!) ?? trip.trip_headsign ?? '';
    const category = scheduledCategory(trainCode, trip.route_id ?? '');
    for (const st of stopTimes) {
      const code = stopToStation.get(st.stop_id!);
      // Not where it terminates, and not a stop that only sets passengers down (pickup_type 1).
      if (!code || st === last || st.pickup_type === '1' || !st.departure_time || code === destinationCode) continue;
      const minutes = toMinutes(st.departure_time);
      (byStation[code] ??= []).push({ time: hhmm(minutes), minutes, trainCode, destinationCode, destination, category });
    }
  }
  for (const list of Object.values(byStation)) list.sort((a, b) => a.minutes - b.minutes);
  return { date, byStation };
}

/**
 * Departures at `code` between `fromMinutes` and `toMinutes` after midnight on `today`'s service day. Trains
 * still running after midnight belong to yesterday's service day (times past 24:00), so those are included too.
 */
export function scheduledBetween(
  code: string,
  today: Timetable,
  yesterday: Timetable | undefined,
  fromMinutes: number,
  toMinutes: number,
): ScheduledDeparture[] {
  const lateFromYesterday = (yesterday?.byStation[code] ?? [])
    .filter((d) => d.minutes >= 1440)
    .map((d) => ({ ...d, minutes: d.minutes - 1440 }));
  return [...lateFromYesterday, ...(today.byStation[code] ?? [])]
    .filter((d) => d.minutes >= fromMinutes && d.minutes <= toMinutes)
    .sort((a, b) => a.minutes - b.minutes);
}

const CORK_AREA = new Set(['CORK', 'LSLND', 'GHANE', 'CGTWL', 'MDLTN', 'FOTA', 'CGLOE', 'RBROK', 'COBH', 'MLLOW']);

/**
 * Whether a timetabled train belongs to a service, as `SERVICES[id].matches` does for live trains (the
 * timetable has train codes and destinations, not the live API's origin and train type fields).
 */
export function scheduledMatches(service: 'dart' | 'enterprise' | 'cork' | 'commuter' | 'intercity' | 'nir', d: ScheduledDeparture): boolean {
  const cork = d.category === 'commuter' && !!d.destinationCode && CORK_AREA.has(d.destinationCode);
  switch (service) {
    case 'dart':
      return d.category === 'dart';
    case 'enterprise':
      return d.category === 'enterprise';
    case 'intercity':
      return d.category === 'intercity';
    case 'cork':
      return cork;
    case 'commuter':
      return d.category === 'commuter' && !cork;
    default:
      return false;
  }
}
