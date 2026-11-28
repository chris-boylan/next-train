/**
 * Luas, Dublin's trams: the Red and Green lines, as one service (the map shows both, with a chip for each). They
 * share no stops (they meet only by a short walk in the city centre), so one station page always shows one line.
 *
 * Paths run from the far ends towards and through the city, like the other lines run south to north, so with
 * the line helpers "Northbound" (the up track) is inbound: towards the city, and beyond it to The Point, Connolly
 * or Broombridge. The feed's own Inbound/Outbound agree.
 *
 * Red: Tallaght and Saggart branches meet at Belgard; in the city, trams carry on from Busáras either to The Point
 * or to Connolly (a short spur). Green: Brides Glen (or Sandyford) to Broombridge (or Parnell). Through the city
 * centre it's a one-way loop between Dawson and Dominick (see LOOP_ONE_WAY), so those stops each see trams one way
 * only (the feed says "No Northbound/Southbound Service" for the other).
 */
import type { Journey, JourneyStop, TrainNow } from './journey';
import { directionBetween, type Line, runsBetween } from './line';
import type { LuasClient, RawLuasForecast, RawLuasTram } from './luasClient';
import { LUAS_RUN_SECONDS } from './luasRunTimes.data';
import { LUAS_STATIONS } from './stations';
import type { Departure, Direction, Station } from './types';

export type LuasRouteId = 'red' | 'green';

export interface LuasRoute {
  id: LuasRouteId;
  line: Line;
}

const lu = (codes: string[]) => codes.map((c) => `LU_${c}`);

const TALLAGHT = lu(['TAL', 'HOS', 'COO', 'BEL']);
const SAGGART = lu(['SAG', 'FOR', 'CIT', 'CVN', 'FET', 'BEL']);
const RED_TRUNK = lu(['KIN', 'RED', 'KYL', 'BLU', 'BLA', 'DRI', 'GOL', 'SUI', 'RIA', 'FAT', 'JAM', 'HEU', 'MUS', 'SMI', 'FOU', 'JER', 'ABB', 'BUS']);
const TO_POINT = lu(['GDK', 'MYS', 'SDK', 'TPT']);
const TO_CONNOLLY = lu(['CON']);

const GREEN_SOUTH = lu(['BRI', 'CHE', 'LAU', 'CCK', 'BAW', 'LEO', 'GAL', 'GLE', 'CPK', 'SAN', 'STI', 'KIL', 'BAL', 'DUN', 'WIN', 'MIL', 'COW', 'BEE', 'RAN', 'CHA', 'HAR', 'STS', 'DAW']);
const GREEN_NORTH = lu(['DOM', 'BRD', 'GRA', 'PHI', 'CAB', 'BRO']);
/**
 * The city-centre loop, as the feed serves it (checked 28 Nov 2026): northbound by Westmoreland, O'Connell – GPO
 * and O'Connell – Upper, then on to Dominick (Broombridge trams) or round into Parnell, where "Parnell" trams end;
 * southbound from Dominick by Parnell, Marlborough and Trinity. Listed south to north like the rest.
 */
const LOOP_NORTHBOUND = lu(['WES', 'OGP', 'OUP']);
const LOOP_SOUTHBOUND = lu(['TRY', 'MAR', 'PAR']);
/** The loop's track, each piece run one way only. */
const LOOP_ONE_WAY: [string, string][] = (
  [
    ['DAW', 'WES'], ['WES', 'OGP'], ['OGP', 'OUP'], ['OUP', 'DOM'], ['OUP', 'PAR'],
    ['DOM', 'PAR'], ['PAR', 'MAR'], ['MAR', 'TRY'], ['TRY', 'DAW'],
  ] as const
).map(([a, b]) => [`LU_${a}`, `LU_${b}`]);

export const LUAS_RED_LINE: Line = {
  paths: [
    [...TALLAGHT, ...RED_TRUNK, ...TO_POINT],
    [...TALLAGHT, ...RED_TRUNK, ...TO_CONNOLLY],
    [...SAGGART, ...RED_TRUNK, ...TO_POINT],
    [...SAGGART, ...RED_TRUNK, ...TO_CONNOLLY],
  ],
  termini: { Northbound: lu(['TPT', 'CON']), Southbound: lu(['TAL', 'SAG']) },
};

export const LUAS_GREEN_LINE: Line = {
  paths: [
    [...GREEN_SOUTH, ...LOOP_NORTHBOUND, ...GREEN_NORTH],
    [...GREEN_SOUTH, ...LOOP_SOUTHBOUND, ...GREEN_NORTH],
    // "Parnell" trams: up the northbound side and round into Parnell.
    [...GREEN_SOUTH, ...LOOP_NORTHBOUND, 'LU_PAR'],
  ],
  termini: { Northbound: lu(['BRO', 'PAR']), Southbound: lu(['BRI', 'SAN']) },
  oneWay: LOOP_ONE_WAY,
};

/** The track no tram serves at a stop on the city-centre loop (each side is one way), if it's one of them. */
export function luasUnservedAt(code: string): Direction | undefined {
  if (LOOP_NORTHBOUND.includes(code)) return 'Southbound';
  if (LOOP_SOUTHBOUND.includes(code)) return 'Northbound';
  return undefined;
}

/** The loop's one-way track, for the map's arrows. */
export const LUAS_ONE_WAY = LOOP_ONE_WAY;

export const LUAS_ROUTES: LuasRoute[] = [
  { id: 'red', line: LUAS_RED_LINE },
  { id: 'green', line: LUAS_GREEN_LINE },
];

/** Both lines as one, for the service: a station's page uses whichever line it's on. */
export const LUAS_LINE: Line = {
  paths: [...LUAS_RED_LINE.paths, ...LUAS_GREEN_LINE.paths],
  termini: {
    Northbound: [...LUAS_RED_LINE.termini.Northbound, ...LUAS_GREEN_LINE.termini.Northbound],
    Southbound: [...LUAS_RED_LINE.termini.Southbound, ...LUAS_GREEN_LINE.termini.Southbound],
  },
  oneWay: LOOP_ONE_WAY,
};

/** Every Luas stop, each once, in route order. */
export const LUAS_STATION_CODES: string[] = [...new Set(LUAS_ROUTES.flatMap((r) => r.line.paths.flat()))];

export const isLuasStop = (code: string) => code.startsWith('LU_');

/** Which line a Luas stop is on (they share none). */
export const luasLineOf = (code: string): LuasRouteId => (LUAS_RED_LINE.paths.some((p) => p.includes(code)) ? 'red' : 'green');

/** A Luas stop's live departures, and what the feed says about the line (its status, and any one-way stop). */
export interface LuasDepartures {
  departures: Departure[];
  /** The line's status, e.g. "Green Line services operating normally" or "No service Red Cow – Tallaght". */
  message: string;
  /** True when the message isn't the usual "operating normally": a disruption worth showing. */
  disrupted: boolean;
  /** Tracks where no trams stop here at all: one way round the city-centre loop. */
  noService: Direction[];
}

/** "St. Stephen's Green" and "St Stephen's Green" alike, for matching the feed's destinations to stops. */
const key = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');

/** HH:mm in Irish time, `mins` from `now`. */
function clockIn(now: number, mins: number): string {
  return new Intl.DateTimeFormat('en-IE', { timeZone: 'Europe/Dublin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(now + mins * 60_000),
  );
}

/**
 * A stop's forecast as departures, for the station page and board. Each tram's track comes from the line layout
 * (towards its destination), else from the feed's Inbound (up) or Outbound (down). Trams have no IDs, so each gets
 * one from its direction, destination and due time, which stays the same from one refresh to the next while the
 * tram's estimate holds.
 */
export function toLuasDepartures(forecast: RawLuasForecast, code: string, stops: Station[], now: number): LuasDepartures {
  const byName = new Map(stops.map((s) => [key(s.apiName ?? s.name), s] as const));
  for (const s of stops) byName.set(key(s.name), s);
  const noService: Direction[] = [];
  const departures: Departure[] = [];
  const add = (trams: RawLuasTram[], side: 'Inbound' | 'Outbound') => {
    const fallback: Direction = side === 'Inbound' ? 'Northbound' : 'Southbound';
    for (const tram of trams) {
      if (/^No (North|South)bound Service$/i.test(tram.destination)) {
        noService.push(/^No North/i.test(tram.destination) ? 'Northbound' : 'Southbound');
        continue;
      }
      // Pseudo-trams ("See news for information") have no minutes.
      if (tram.dueMins === '') continue;
      const due = /^due$/i.test(tram.dueMins) ? 0 : Number.parseInt(tram.dueMins, 10);
      if (!Number.isFinite(due)) continue;
      const destination = byName.get(key(tram.destination));
      const direction = (destination && destination.code !== code && directionBetween(code, destination.code, LUAS_LINE)) || fallback;
      const time = clockIn(now, due);
      departures.push({
        trainCode: `${side[0]}-${destination?.code ?? key(tram.destination)}-${time.replace(':', '')}`,
        origin: '',
        destination: destination?.name ?? tram.destination,
        ...(destination && { destinationCode: destination.code }),
        direction,
        dueInMins: due,
        expectedDepart: time,
        scheduledDepart: time,
        lateMins: 0,
        trainType: 'Luas',
        category: 'luas',
        lastLocation: '',
      });
    }
  };
  add(forecast.inbound, 'Inbound');
  add(forecast.outbound, 'Outbound');
  departures.sort((a, b) => a.dueInMins - b.dueInMins);
  return {
    departures,
    message: forecast.message,
    disrupted: isLuasDisruption(forecast.message),
    noService,
  };
}

/** A stop's live departures, by our code (LU_RAN). */
export async function getLuasDepartures(client: LuasClient, code: string, stops: Station[], now = Date.now()): Promise<LuasDepartures> {
  const forecast = await client.getForecast(code.replace(/^LU_/, ''));
  return toLuasDepartures(forecast, code, stops, now);
}

/** Whether a line's status message is news: anything but "… services operating normally" (delays, no service). */
export const isLuasDisruption = (message: string) => !!message && !/operating normally/i.test(message);

/** A line's status, as the feed gives it at every one of its stops. */
export interface LuasLineStatus {
  /** E.g. "Green Line services operating with delays" or "No service Red Cow – Tallaght / Saggart. See news.". */
  message: string;
  disrupted: boolean;
}

/** The stop each line's status is read from: any would do, as every stop carries its line's message. */
const STATUS_STOPS: Record<LuasRouteId, string> = { red: 'JER', green: 'MAR' };

/**
 * Both lines' status, for the map's news ticker: one forecast per line (cached by the client like any other).
 * A line whose forecast fails is left out rather than failing the other.
 */
export async function getLuasStatus(client: LuasClient): Promise<Partial<Record<LuasRouteId, LuasLineStatus>>> {
  const lines = await Promise.all(
    LUAS_ROUTES.map(async ({ id }) => {
      try {
        const { message } = await client.getForecast(STATUS_STOPS[id]);
        return [id, { message, disrupted: isLuasDisruption(message) }] as const;
      } catch (err) {
        console.error(`Luas status for the ${id} line:`, err);
        return undefined;
      }
    }),
  );
  return Object.fromEntries(lines.filter((line) => line !== undefined));
}

/** A tram's way from one stop to another, in travel order, along track trams run that way (the loop is one way). */
function luasRoute(from: string, to: string, direction: Direction): string[] | undefined {
  for (const path of LUAS_LINE.paths) {
    const ordered = direction === 'Northbound' ? path : [...path].reverse();
    const i = ordered.indexOf(from);
    const j = ordered.indexOf(to);
    if (i < 0 || j <= i) continue;
    const way = ordered.slice(i, j + 1);
    if (way.every((code, k) => k === 0 || runsBetween(way[k - 1]!, code, LUAS_LINE))) return way;
  }
  return undefined;
}

/** The track behind a stop, nearest first, on the way a tram to `to` comes: for placing it before it arrives. */
function luasRouteBehind(from: string, to: string, direction: Direction): string[] {
  for (const path of LUAS_LINE.paths) {
    const ordered = direction === 'Northbound' ? path : [...path].reverse();
    const i = ordered.indexOf(from);
    const j = ordered.indexOf(to);
    if (i < 0 || j <= i) continue;
    const way = ordered.slice(0, j + 1);
    if (way.every((code, k) => k === 0 || runsBetween(way[k - 1]!, code, LUAS_LINE))) return ordered.slice(0, i).reverse();
  }
  return [];
}

const luasName = (code: string) => LUAS_STATIONS.find((s) => s.code === code)?.name ?? code;

/**
 * A tram's stops ahead, estimated: the feed gives each stop its next trams but no tram IDs, so a tram can't be
 * followed from stop to stop. From its live time at `from` (`dueAt`, epoch ms), each later stop adds the
 * timetable's run time from the one before (LUAS_RUN_SECONDS). Where it is now is estimated the same way
 * backwards: due in 2 min where the last stretch takes 3 means it left the stop before about a minute ago.
 * Undefined when its destination isn't ahead on its track, or a stretch has no run time.
 */
export function luasJourney(departure: Departure, from: string, dueAt: number, now: number): Journey | undefined {
  const to = departure.destinationCode;
  if (!to) return undefined;
  const direction: Direction = departure.direction === 'Southbound' ? 'Southbound' : 'Northbound';
  const way = luasRoute(from, to, direction);
  if (!way) return undefined;
  const run = (a: string, b: string) => LUAS_RUN_SECONDS[`${a}>${b}`];
  const stops: JourneyStop[] = [];
  let at = dueAt;
  for (let k = 0; k < way.length; k++) {
    if (k > 0) {
      const seconds = run(way[k - 1]!, way[k]!);
      if (seconds === undefined) return undefined;
      at += seconds * 1000;
    }
    const inMins = Math.round((at - now) / 60_000);
    const time = clockIn(now, inMins);
    stops.push({ code: way[k]!, name: luasName(way[k]!), expected: time, scheduled: time, lateMins: 0, inMins, cancelled: false });
  }

  // Where it is now: back along the track from `from` until the time to come is used up.
  let left = (dueAt - now) / 1000;
  let position: TrainNow = { kind: 'at', code: from, name: luasName(from) };
  if (left > 30) {
    let ahead = from;
    for (const behind of luasRouteBehind(from, to, direction)) {
      const seconds = run(behind, ahead);
      if (seconds === undefined) break;
      if (left <= seconds) {
        position = { kind: 'left', code: behind, name: luasName(behind), minsAgo: Math.max(0, Math.round((seconds - left) / 60)) };
        left = 0;
        break;
      }
      left -= seconds;
      ahead = behind;
    }
    // Further out than the line goes back: it hasn't set off yet.
    if (left > 0) position = { kind: 'notStarted', code: ahead, name: luasName(ahead), departs: clockIn(now, Math.round(left / 60)) };
  }
  return { trainCode: departure.trainCode, origin: '', destination: departure.destination, now: position, stops, estimated: true };
}
