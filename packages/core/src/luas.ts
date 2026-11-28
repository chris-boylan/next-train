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
 * centre it's a one-way loop between Dawson and Dominick: northbound by Westmoreland, O'Connell – GPO and O'Connell
 * – Upper; southbound by Parnell, Marlborough and Trinity. Trams "to Parnell" go round the loop and finish there.
 * So those stops each see trams one way only (the feed says "No Northbound/Southbound Service" for the other).
 */
import { directionBetween, type Line } from './line';
import type { LuasClient, RawLuasForecast, RawLuasTram } from './luasClient';
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
/** The city-centre loop: the northbound way round, and the southbound way (listed south to north like the rest). */
const LOOP_NORTHBOUND = lu(['WES', 'OGP', 'OUP']);
const LOOP_SOUTHBOUND = lu(['TRY', 'MAR', 'PAR']);

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
  ],
  termini: { Northbound: lu(['BRO', 'PAR']), Southbound: lu(['BRI', 'SAN']) },
};

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
    disrupted: !!forecast.message && !/operating normally/i.test(forecast.message),
    noService,
  };
}

/** A stop's live departures, by our code (LU_RAN). */
export async function getLuasDepartures(client: LuasClient, code: string, stops: Station[], now = Date.now()): Promise<LuasDepartures> {
  const forecast = await client.getForecast(code.replace(/^LU_/, ''));
  return toLuasDepartures(forecast, code, stops, now);
}
