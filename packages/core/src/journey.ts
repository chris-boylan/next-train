// A single train's journey from one station to its terminus, for the station page's look-ahead view: the stops
// ahead with expected arrival times, and where the train is now. Built from `getTrainMovementsXML`, which lists
// every location with scheduled, expected and (once passed) actual times.
import type { RawTrainMovement } from './irishRailClient';

export interface JourneyStop {
  code: string;
  /** Irish Rail's name; apps show their own (and Irish) names where they know the station. */
  name: string;
  /** Expected arrival, `HH:mm` (departure at the train's origin). */
  expected: string;
  /** Timetabled arrival, `HH:mm`. */
  scheduled: string;
  /** Minutes late at this stop (negative means early). */
  lateMins: number;
  /** Minutes from now until the train is expected here (negative once it's due or has been). */
  inMins: number;
  /** The train won't call here after all. */
  cancelled: boolean;
}

export type TrainNow =
  | { kind: 'notStarted'; code: string; name: string; departs: string }
  | { kind: 'at'; code: string; name: string }
  | { kind: 'left'; code: string; name: string; minsAgo: number };

export interface Journey {
  trainCode: string;
  origin: string;
  destination: string;
  now: TrainNow;
  /** From the station the journey was opened at, to the terminus. */
  stops: JourneyStop[];
  /** Times worked out rather than reported: a Luas tram's, from its time at one stop and the timetable's run times. */
  estimated?: boolean;
}

const DAY = 24 * 60 * 60;

/** `HH:MM:SS` to seconds after midnight; undefined for blanks and the API's `00:00:00` "no time". */
function seconds(time: unknown): number | undefined {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}:\d{2}$/.test(time) || time === '00:00:00') return undefined;
  const [h, m, s] = time.split(':').map(Number) as [number, number, number];
  return h * 3600 + m * 60 + s;
}

/** Seconds after midnight, Irish time. */
export function irishSecondsOfDay(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

/** a − b in seconds, taking the shorter way round midnight (a train at 00:05 is 10 minutes after 23:55). */
function diff(a: number, b: number): number {
  const d = a - b;
  return d > DAY / 2 ? d - DAY : d < -DAY / 2 ? d + DAY : d;
}

const hhmm = (secs: number) => `${String(Math.floor(secs / 3600) % 24).padStart(2, '0')}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}`;
const trim = (value: unknown) => String(value ?? '').trim();

/** Returns undefined when the train doesn't call at `fromCode`. */
export function buildJourney(movements: RawTrainMovement[], fromCode: string, nowMs: number): Journey | undefined {
  // Stops only (origin, stop, destination, cancelled stop), in order; timing points (T) aren't stations.
  const stops = [...movements]
    .sort((a, b) => Number(a.LocationOrder) - Number(b.LocationOrder))
    .filter((m) => ['O', 'S', 'D', 'C'].includes(trim(m.LocationType)))
    .filter((m, i, all) => trim(m.LocationCode) !== trim(all[i - 1]?.LocationCode));
  const from = stops.findIndex((m) => trim(m.LocationCode) === fromCode.toUpperCase());
  const first = stops[0];
  if (from < 0 || !first) return undefined;

  const now = irishSecondsOfDay(nowMs);
  const journeyStops: JourneyStop[] = stops.slice(from).map((m) => {
    const expected = seconds(m.ExpectedArrival) ?? seconds(m.ExpectedDeparture) ?? 0;
    const scheduled = seconds(m.ScheduledArrival) ?? seconds(m.ScheduledDeparture) ?? expected;
    return {
      code: trim(m.LocationCode),
      name: trim(m.LocationFullName),
      expected: hhmm(expected),
      scheduled: hhmm(scheduled),
      lateMins: Math.round(diff(expected, scheduled) / 60),
      inMins: Math.round(diff(expected, now) / 60),
      cancelled: trim(m.LocationType) === 'C',
    };
  });

  return {
    trainCode: trim(first.TrainCode),
    origin: trim(first.TrainOrigin),
    destination: trim(first.TrainDestination),
    now: trainNow(stops, now),
    stops: journeyStops,
  };
}

/** The last stop with an actual arrival or departure: at a platform, or left it so many minutes ago. */
function trainNow(stops: RawTrainMovement[], now: number): TrainNow {
  for (let i = stops.length - 1; i >= 0; i--) {
    const m = stops[i]!;
    if (trim(m.LocationType) === 'C') continue;
    const code = trim(m.LocationCode);
    const name = trim(m.LocationFullName);
    const left = seconds(m.Departure);
    if (left !== undefined) return { kind: 'left', code, name, minsAgo: Math.max(0, Math.round(diff(now, left) / 60)) };
    if (seconds(m.Arrival) !== undefined) return { kind: 'at', code, name };
  }
  const origin = stops[0]!;
  return {
    kind: 'notStarted',
    code: trim(origin.LocationCode),
    name: trim(origin.LocationFullName),
    departs: hhmm(seconds(origin.ExpectedDeparture) ?? seconds(origin.ScheduledDeparture) ?? 0),
  };
}
