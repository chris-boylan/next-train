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
import { findStationByName } from './stations';
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

  // Last seen at a signal: approach the next stop from the station before it, on the way the train is going.
  const before = previousStation(next, direction, originCode, line);
  return before ? { ...base, from: before, progress: SIGNAL_PROGRESS } : { ...base, at: next, progress: 0 };
}

/**
 * Services whose maps can show live trains so far. Not Cork: its commuter trains aren't in Irish Rail's positions
 * feed (their boards say "No Information"), though `placeTrain` and the map support it if that changes.
 */
export const LIVE_SERVICES = ['dart', 'enterprise'] as const satisfies readonly ServiceId[];
export type LiveServiceId = (typeof LIVE_SERVICES)[number];

export function isLiveService(value: unknown): value is LiveServiceId {
  return (LIVE_SERVICES as readonly unknown[]).includes(value);
}

/** Every running train on a service's line, placed for the map. */
export async function getLiveTrains(client: IrishRailClient, serviceId: ServiceId = 'dart'): Promise<LiveTrain[]> {
  const raw = serviceId === 'dart' ? await client.getCurrentDarts() : await client.getCurrentTrains();
  return raw.map((r) => placeTrain(r, serviceId)).filter((t): t is LiveTrain => !!t);
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
    Traintype: 'Train',
  } as RawStationData;
}
