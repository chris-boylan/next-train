// Where each running train is right now, placed on a line for the live map.
//
// One `getCurrentTrainsXML` call gives every train with a message like
//   E117\n13:55 - Howth to Greystones (12 mins late)\nDeparted Shankill next stop Killiney
// so a train is either at a station ("Arrived X") or between two ("Departed X next stop Y"). The last
// location is sometimes a signal or junction (`North Strand Junction`, `PL101`) rather than a station: the
// train is then drawn just short of its next stop.
import type { IrishRailClient, RawStationData, RawTrainPosition } from './irishRailClient';
import { adjacentStations, directionBetween, type Line, route } from './line';
import { SERVICES, type ServiceId } from './services';
import { isTracked } from './departures';
import { findStationByCode, findStationByName } from './stations';
import type { Direction } from './types';

export type TrainState = 'arrived' | 'departed' | 'not-started' | 'terminated' | 'unknown';

export interface ParsedTrainMessage {
  code: string;
  /** When the train started (or starts) its run, `HH:mm`. */
  scheduledStart?: string;
  origin?: string;
  destination?: string;
  /** Minutes late; negative when early. */
  lateMins?: number;
  state: TrainState;
  /** Where the train last reported: a station name, or a signal / junction. */
  last?: string;
  next?: string;
}

export interface LiveTrain {
  code: string;
  origin: string;
  destination: string;
  /** Station code of the destination, when it's on the line. */
  destinationCode?: string;
  direction: Direction;
  /** Station code, when the train is standing at a station. */
  at?: string;
  /** Station code it last left; undefined when it's at a station, or last seen at a signal. */
  from?: string;
  /** Next stop's station code. */
  to: string;
  /** 0–1 along from → to; 0 when the train is standing `at` a station. */
  progress: number;
  /** Minutes late; negative when early. */
  lateMins: number;
  /**
   * Irish Rail isn't tracking it (the Enterprise in Northern Ireland): placed from its timetable times on the
   * station boards, so its position is an estimate and its lateness unknown.
   */
  estimated?: true;
}

/** How far along the gap a departed train is drawn. Without timings, halfway reads best. */
export const DEPARTED_PROGRESS = 0.5;
/** A train last seen at a signal is drawn just short of its next stop. */
export const SIGNAL_PROGRESS = 0.75;

/** Splits a `PublicMessage`. The API sends a literal backslash-n between lines. */
export function parsePublicMessage(message: string): ParsedTrainMessage {
  const lines = message.split(/\\n|\n/).map((l) => l.trim());
  const code = lines[0] ?? '';
  const parsed: ParsedTrainMessage = { code, state: 'unknown' };

  // e.g. `13:55 - Howth to Greystones (12 mins late)`, or `14:55 - Howth to Greystones(-2 mins late)`, or
  // (not started) just `Greystones to Malahide`.
  const run = lines[1]?.match(/^(?:(\d{1,2}:\d{2})\s*-\s*)?(.+?)\s+to\s+(.+?)\s*(?:\((-?\d+)\s*mins?\s*(late|early)\))?$/i);
  if (run) {
    parsed.scheduledStart = run[1];
    parsed.origin = run[2]!.trim();
    parsed.destination = run[3]!.trim();
    if (run[4] !== undefined) {
      const mins = Number(run[4]);
      parsed.lateMins = run[5]!.toLowerCase() === 'early' ? -mins : mins;
    }
  }

  const status = lines[2] ?? '';
  const moving = status.match(/^(Arrived|Departed)\s+(.+?)\s+next stop\s+(.+)$/i);
  if (moving) {
    parsed.state = moving[1]!.toLowerCase() === 'arrived' ? 'arrived' : 'departed';
    parsed.last = moving[2]!.trim();
    parsed.next = moving[3]!.trim();
  } else if (/^Expected Departure/i.test(status)) {
    parsed.state = 'not-started';
  } else if (/^TERMINATED/i.test(status)) {
    parsed.state = 'terminated';
  }
  return parsed;
}

/** Places one train on a service's line; undefined when it isn't running there. */
export function placeTrain(raw: RawTrainPosition, serviceId: ServiceId = 'dart'): LiveTrain | undefined {
  if (raw.TrainStatus?.trim() !== 'R') return undefined;
  const msg = parsePublicMessage(raw.PublicMessage ?? '');
  if (msg.state !== 'arrived' && msg.state !== 'departed') return undefined;

  const service = SERVICES[serviceId];
  // The DART feed holds only DARTs; on shared track (Connolly–Drogheda) other services' trains must be told apart,
  // using the same origin / destination / train-code rules as the departure boards.
  if (serviceId !== 'dart' && !service.matches(asStationData(raw, msg))) return undefined;
  const codeOf = (name: string | undefined) => (name ? findStationByName(name, service.stations)?.code : undefined);
  const next = codeOf(msg.next);
  if (!next) return undefined;
  const last = codeOf(msg.last);
  const destinationCode = codeOf(msg.destination);
  const originCode = codeOf(msg.origin);
  const line = service.line;

  // Direction comes from the line, not the API (which says "To Cork" etc. off the DART).
  const direction =
    (last && last !== next ? directionBetween(last, next, line) : undefined) ??
    (destinationCode && destinationCode !== next ? directionBetween(next, destinationCode, line) : undefined) ??
    // Next stop is the last one and the last location is off the line (Belfast–Connolly "Departed Portmarnock"):
    // the way from where it started. The API's own direction reads "To Dublin Connolly" off the DART.
    (originCode && originCode !== next ? directionBetween(originCode, next, line) : undefined) ??
    (raw.Direction === 'Northbound' || raw.Direction === 'Southbound' ? raw.Direction : undefined);
  if (!direction) return undefined;

  const base = {
    code: raw.TrainCode.trim(),
    origin: msg.origin ?? '',
    destination: msg.destination ?? '',
    ...(destinationCode && { destinationCode }),
    direction,
    to: next,
    lateMins: msg.lateMins ?? 0,
  };

  if (last && route(last, next, line)) {
    return msg.state === 'arrived'
      ? { ...base, at: last, progress: 0 }
      : { ...base, from: last, progress: DEPARTED_PROGRESS };
  }

  // Last seen somewhere not on this line: between the station before the next stop and the next stop.
  const before = previousStation(next, direction, originCode, line);
  if (!before) return { ...base, at: next, progress: 0 };
  // A station the train passes without stopping (an Enterprise "Departed Raheny"): as far along as it really is.
  // Otherwise a signal or junction, drawn just short of the next stop.
  const passed = msg.last ? findStationByName(msg.last) : undefined;
  const progress = passed ? progressPast(before, passed.code, next) : undefined;
  return { ...base, from: before, progress: progress ?? SIGNAL_PROGRESS };
}

/** Straight-line distance between two stations, in km; undefined if either has no position. */
function distanceKm(a: string, b: string): number | undefined {
  const p = findStationByCode(a);
  const q = findStationByCode(b);
  if (!p || !q || (!p.lat && !p.lon) || (!q.lat && !q.lon)) return undefined;
  const n = (q.lat - p.lat) * 111;
  const e = (q.lon - p.lon) * 111 * Math.cos((p.lat * Math.PI) / 180);
  return Math.hypot(n, e);
}

/** How far from `from` to `to` a train at `passed` is (0–1), by real distances; kept off the two dots themselves. */
export function progressPast(from: string, passed: string, to: string): number | undefined {
  const done = distanceKm(from, passed);
  const left = distanceKm(passed, to);
  if (done === undefined || left === undefined || done + left === 0) return undefined;
  return Math.min(0.9, Math.max(0.1, done / (done + left)));
}

/**
 * Services whose maps can show live trains so far. Not Cork: its commuter trains aren't in Irish Rail's positions
 * feed (their boards say "No Information"), though `placeTrain` and the map support it if that changes.
 */
export const LIVE_SERVICES = ['dart', 'enterprise', 'commuter', 'intercity'] as const satisfies readonly ServiceId[];
export type LiveServiceId = (typeof LIVE_SERVICES)[number];

export function isLiveService(value: unknown): value is LiveServiceId {
  return (LIVE_SERVICES as readonly unknown[]).includes(value);
}

/**
 * Services whose maps also read every station's board, to catch what the positions feed gets wrong. Irish Rail
 * doesn't track the Enterprise in Northern Ireland: Belfast-bound trains freeze at "Departed Dundalk next stop
 * Newry" for hours after arriving, and Dublin-bound ones are missing until they reach Dundalk. Six stations, so
 * six cached calls a refresh; not the DART (31 stations, and tracked throughout).
 */
const CHECK_BOARDS: ReadonlySet<ServiceId> = new Set(['enterprise']);

/** Every running train on a service's line, placed for the map. */
export async function getLiveTrains(client: IrishRailClient, serviceId: ServiceId = 'dart'): Promise<LiveTrain[]> {
  const raw = serviceId === 'dart' ? await client.getCurrentDarts() : await client.getCurrentTrains();
  const tracked = raw.map((r) => placeTrain(r, serviceId)).filter((t): t is LiveTrain => !!t);
  if (!CHECK_BOARDS.has(serviceId)) return tracked;

  const service = SERVICES[serviceId];
  const codes = [...new Set(service.line.paths.flat())];
  // A board that fails to load is left out: nothing is dropped or estimated on its say-so.
  const boards = new Map<string, RawStationData[]>();
  await Promise.all(
    codes.map(async (code) => {
      const rows = await client.getStationData(code).catch(() => undefined);
      if (rows) boards.set(code, rows.filter((r) => service.matches(r)));
    }),
  );
  return withBoards(tracked, boards, serviceId);
}

/**
 * Checks placed trains against the stations' boards: drops a "tracked" train its next stop doesn't expect (a
 * position frozen at the border), and adds trains running untracked, estimated from their times on the boards.
 */
export function withBoards(tracked: LiveTrain[], boards: Map<string, RawStationData[]>, serviceId: ServiceId): LiveTrain[] {
  const line = SERVICES[serviceId].line;
  const code = (r: RawStationData) => r.Traincode.trim();
  const listed = (station: string, train: string) => boards.get(station)?.some((r) => code(r) === train);
  const real = tracked.filter((t) => !boards.has(t.to) || listed(t.to, t.code));

  // Untracked trains, by train: every station still ahead of them, with how many minutes away each is.
  const ahead = new Map<string, { station: string; due: number; row: RawStationData }[]>();
  for (const [station, rows] of boards) {
    for (const row of rows) {
      if (isTracked(row) || real.some((t) => t.code === code(row))) continue;
      const due = Number.parseInt(row.Duein, 10);
      if (!Number.isFinite(due)) continue;
      ahead.set(code(row), [...(ahead.get(code(row)) ?? []), { station, due, row }]);
    }
  }
  const estimated = [...ahead.entries()].flatMap(([train, stops]): LiveTrain[] => {
    stops.sort((a, b) => a.due - b.due);
    const next = stops[0]!;
    const row = next.row;
    const originCode = findStationByName(row.Origin, SERVICES[serviceId].stations)?.code;
    const destinationCode = findStationByName(row.Destination, SERVICES[serviceId].stations)?.code;
    const direction =
      (destinationCode && destinationCode !== next.station ? directionBetween(next.station, destinationCode, line) : undefined) ??
      (originCode && originCode !== next.station ? directionBetween(originCode, next.station, line) : undefined);
    if (!direction) return [];
    const base = {
      code: train,
      origin: row.Origin,
      destination: row.Destination,
      ...(destinationCode && { destinationCode }),
      direction,
      to: next.station,
      lateMins: 0,
      estimated: true as const,
    };
    if (next.due <= 0) return [{ ...base, at: next.station, progress: 0 }];
    const from = previousStation(next.station, direction, originCode, line);
    if (!from) return [];
    return [{ ...base, from, progress: estimateProgress(from, next.station, next.due, stops[1]) }];
  });
  return [...real, ...estimated];
}

/** An InterCity-ish speed, for a gap whose timing we can't read off the boards (km a minute: 90 km/h). */
const TYPICAL_KM_PER_MIN = 1.5;

/**
 * How far from `from` to `to` a train due at `to` in `due` minutes is. The boards only list stations still ahead,
 * so the gap's length in minutes is estimated from its distance, at the train's own speed between the next two
 * stops where the boards give both, else a typical one.
 */
function estimateProgress(from: string, to: string, due: number, after?: { station: string; due: number }): number {
  const gap = distanceKm(from, to);
  if (gap === undefined) return SIGNAL_PROGRESS;
  const later = after && after.due > due ? distanceKm(to, after.station) : undefined;
  const speed = later !== undefined && after ? Math.min(2.5, Math.max(0.8, later / (after.due - due))) : TYPICAL_KM_PER_MIN;
  return Math.min(0.95, Math.max(0.05, 1 - (due * speed) / gap));
}

/** The station a train heading `direction` passes just before `code`. At a fork, the one on its path from its origin. */
function previousStation(
  code: string,
  direction: Direction,
  originCode: string | undefined,
  line: Line,
): string | undefined {
  const { north, south } = adjacentStations(code, line);
  const candidates = direction === 'Northbound' ? south : north;
  if (candidates.length <= 1 || !originCode) return candidates[0];
  return candidates.find((c) => route(originCode, code, line)?.includes(c)) ?? candidates[0];
}

/** Just enough of a departure-board row for `Service.matches`, which reads the code, origin, destination and type. */
function asStationData(raw: RawTrainPosition, msg: ParsedTrainMessage): RawStationData {
  return {
    Traincode: raw.TrainCode,
    Origin: msg.origin ?? '',
    Destination: msg.destination ?? '',
    // The positions feed has no train type; DART codes start with E (E117), as the departures' DART type does.
    Traintype: raw.TrainCode.trim().startsWith('E') ? 'DART' : 'Train',
  } as RawStationData;
}
