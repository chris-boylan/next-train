// NI Railways' timetable, from Translink's TransXChange file on OpenDataNI ("Translink Northern Ireland Rail
// Timetable Data", Open Government Licence). The file has NIR and the Enterprise; the Enterprise is left out,
// since Irish Rail's GTFS already has it (with the train codes the live API uses).
//
// TransXChange times aren't listed per stop: a journey has a departure time and a journey pattern, whose timing
// links give the run time to the next stop and any wait there. Stops are matched to our stations by position,
// as GTFS stops are. Only what Translink's file uses is read (checked against the September 2026 release):
// weekly day types, days of non-operation and operation, and one journey pattern section per pattern.
import { matchStops, type ScheduledDeparture, type Timetable } from './timetable';
import type { Station } from './types';

/** The Enterprise's operator in the file. Its trains come from Irish Rail's timetable instead. */
const ENTERPRISE_OPERATOR = 'OId_ENT';

export interface TxcStop {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TxcLink {
  from: { stop: string; activity: string };
  to: { stop: string; activity: string; waitMins: number };
  runMins: number;
}

/** Which days a journey runs: weekdays (0 = Sunday), plus dates (`YYYYMMDD`) added or taken away. */
export interface TxcDays {
  weekdays: Set<number>;
  notOn: [string, string][];
  alsoOn: [string, string][];
}

export interface TxcJourney {
  code: string;
  /** Minutes after midnight. */
  departs: number;
  links: TxcLink[];
  days: TxcDays;
  /** The service's operating period, `YYYYMMDD`. */
  from: string;
  to: string;
}

export interface Txc {
  stops: TxcStop[];
  journeys: TxcJourney[];
  /** The last day any service in the file runs (`YYYYMMDD`): after it, NIR has no timetable. */
  validUntil: string;
}

// ---------- A small reader for well-formed, machine-written XML ----------

/** The insides of every `<name>` element (not nested in itself). */
function blocks(xml: string, name: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<${name}[\\s>]`, 'g');
  const close = `</${name}>`;
  for (let m = open.exec(xml); m; m = open.exec(xml)) {
    const start = xml.indexOf('>', m.index) + 1;
    const end = xml.indexOf(close, start);
    if (end < 0) break;
    out.push(xml.slice(start, end));
    open.lastIndex = end + close.length;
  }
  return out;
}

const text = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return m ? decode(m[1]!.trim()) : undefined;
};
const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, e: string) =>
    e === 'amp' ? '&' : e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : String.fromCharCode(Number(e.slice(1))),
  );
const attr = (xml: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1];

/** ISO 8601 durations as used here: PT2M, PT1M30S, PT1H5M. */
export function durationMins(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
  if (!m) return 0;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}

const DAY_TAGS: Record<string, number[]> = {
  Sunday: [0],
  Monday: [1],
  Tuesday: [2],
  Wednesday: [3],
  Thursday: [4],
  Friday: [5],
  Saturday: [6],
  MondayToFriday: [1, 2, 3, 4, 5],
  MondayToSaturday: [1, 2, 3, 4, 5, 6],
  MondayToSunday: [0, 1, 2, 3, 4, 5, 6],
  Weekend: [0, 6],
};

const ymd = (isoDate: string) => isoDate.replace(/-/g, '');
const ranges = (xml: string | undefined): [string, string][] =>
  xml ? blocks(xml, 'DateRange').map((r) => [ymd(text(r, 'StartDate') ?? ''), ymd(text(r, 'EndDate') ?? text(r, 'StartDate') ?? '')]) : [];

function parseDays(profile: string): TxcDays {
  const weekdays = new Set<number>();
  for (const dow of blocks(profile, 'DaysOfWeek')) {
    for (const [, tag] of dow.matchAll(/<(\w+)\s*\/>/g)) for (const d of DAY_TAGS[tag!] ?? []) weekdays.add(d);
  }
  const special = blocks(profile, 'SpecialDaysOperation')[0];
  return {
    weekdays,
    notOn: ranges(special && blocks(special, 'DaysOfNonOperation')[0]),
    alsoOn: ranges(special && blocks(special, 'DaysOfOperation')[0]),
  };
}

/** Reads the parts of a TransXChange file needed for departures. */
export function parseTransXChange(xml: string): Txc {
  const stops = blocks(blocks(xml, 'StopPoints')[0] ?? '', 'StopPoint').map((s) => ({
    code: text(s, 'AtcoCode') ?? '',
    name: text(s, 'CommonName') ?? '',
    lat: Number(text(s, 'Latitude')),
    lon: Number(text(s, 'Longitude')),
  }));

  const sections = new Map<string, TxcLink[]>();
  for (const [, id, body] of xml.matchAll(/<JourneyPatternSection id="([^"]+)">([\s\S]*?)<\/JourneyPatternSection>/g)) {
    sections.set(
      id!,
      blocks(body!, 'JourneyPatternTimingLink').map((link) => {
        const from = blocks(link, 'From')[0] ?? '';
        const to = blocks(link, 'To')[0] ?? '';
        return {
          from: { stop: text(from, 'StopPointRef') ?? '', activity: text(from, 'Activity') ?? 'pickUpAndSetDown' },
          // A wait can be given on either end of a stop's links; this file only uses the arriving end.
          to: { stop: text(to, 'StopPointRef') ?? '', activity: text(to, 'Activity') ?? 'pickUpAndSetDown', waitMins: durationMins(text(to, 'WaitTime')) },
          runMins: durationMins(text(link, 'RunTime')),
        };
      }),
    );
  }

  type Service = { operator: string; from: string; to: string; days: TxcDays; patterns: Map<string, string[]> };
  const services = new Map<string, Service>();
  let validUntil = '';
  for (const s of blocks(blocks(xml, 'Services')[0] ?? '', 'Service')) {
    const period = blocks(s, 'OperatingPeriod')[0] ?? '';
    const to = ymd(text(period, 'EndDate') ?? '99991231');
    const operator = text(s, 'RegisteredOperatorRef') ?? '';
    const patterns = new Map<string, string[]>();
    for (const [, id, body] of s.matchAll(/<JourneyPattern id="([^"]+)">([\s\S]*?)<\/JourneyPattern>/g)) {
      patterns.set(id!, blocks(body!, 'JourneyPatternSectionRefs').flatMap((r) => r.trim().split(/\s+/)));
    }
    // The service's own operating profile comes before its journey patterns.
    const profile = blocks(s.slice(0, s.indexOf('<StandardService')), 'OperatingProfile')[0] ?? '';
    services.set(text(s, 'ServiceCode') ?? '', { operator, from: ymd(text(period, 'StartDate') ?? '00000101'), to, days: parseDays(profile), patterns });
    if (operator !== ENTERPRISE_OPERATOR && to > validUntil) validUntil = to;
  }

  const journeys: TxcJourney[] = [];
  for (const vj of blocks(blocks(xml, 'VehicleJourneys')[0] ?? '', 'VehicleJourney')) {
    const service = services.get(text(vj, 'ServiceRef') ?? '');
    if (!service || service.operator === ENTERPRISE_OPERATOR) continue;
    const sectionIds = service.patterns.get(text(vj, 'JourneyPatternRef') ?? '') ?? [];
    const [h, m] = (text(vj, 'DepartureTime') ?? '0:0').split(':').map(Number) as [number, number];
    const profile = blocks(vj, 'OperatingProfile')[0];
    journeys.push({
      code: text(vj, 'VehicleJourneyCode') ?? text(vj, 'PrivateCode') ?? '',
      departs: h * 60 + m,
      links: sectionIds.flatMap((id) => sections.get(id) ?? []),
      // A journey's own operating profile replaces its service's.
      days: profile ? parseDays(profile) : service.days,
      from: service.from,
      to: service.to,
    });
  }
  return { stops, journeys, validUntil };
}

// ---------- Departures ----------

const inRange = (date: string, rs: [string, string][]) => rs.some(([a, b]) => a <= date && date <= b);

/** Whether a journey runs on `date` (`YYYYMMDD`). */
export function runsOn(j: Pick<TxcJourney, 'days' | 'from' | 'to'>, date: string): boolean {
  if (date < j.from || date > j.to) return false;
  if (inRange(date, j.days.alsoOn)) return true;
  const weekday = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8))).getUTCDay();
  return j.days.weekdays.has(weekday) && !inRange(date, j.days.notOn);
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.round(minutes) % 60).padStart(2, '0')}`;

/** "Derry~Londonderry Train Station" → "Derry"; "Grand Central Station" → "Grand Central". */
const placeName = (name: string) =>
  name
    .replace(/\s+(Train|Rail)?\s*Station$/i, '')
    .replace(/Derry~Londonderry|Derry\/Londonderry|Londonderry/g, 'Derry')
    .trim();

/**
 * NI Railways' departures on `date` at each of `stations`, in the same shape as Irish Rail's timetable
 * (`buildTimetable`), so the two can be merged into one file per station.
 */
export function buildNirTimetable(txc: Txc, date: string, stations: Station[]): Timetable {
  // Names without "Train Station", so a stop further than usual from our coordinates still matches by name.
  const stopToStation = matchStops(
    txc.stops.map((s) => ({ stop_id: s.code, stop_name: placeName(s.name), stop_lat: String(s.lat), stop_lon: String(s.lon) })),
    stations,
  );
  const stopName = new Map(txc.stops.map((s) => [s.code, s.name]));
  const byStation: Record<string, ScheduledDeparture[]> = {};

  for (const j of txc.journeys) {
    if (!j.links.length || !runsOn(j, date)) continue;
    const last = j.links.at(-1)!.to.stop;
    const destinationCode = stopToStation.get(last);
    const destination = placeName(stopName.get(last) ?? '');
    let at = j.departs;
    for (const link of j.links) {
      // Departs the link's first stop at `at`, unless the train only sets down or passes there.
      const code = stopToStation.get(link.from.stop);
      const boards = link.from.activity === 'pickUp' || link.from.activity === 'pickUpAndSetDown';
      if (code && boards && code !== destinationCode) {
        const minutes = Math.round(at);
        (byStation[code] ??= []).push({ time: hhmm(minutes), minutes, trainCode: j.code, destinationCode, destination, category: 'nir' });
      }
      at += link.runMins + link.to.waitMins;
    }
  }
  for (const list of Object.values(byStation)) list.sort((a, b) => a.minutes - b.minutes);
  return { date, byStation };
}
