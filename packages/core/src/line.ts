// The shape of the DART line. Verified (Nov 2026) against Irish Rail train stop lists
// (`getTrainMovementsXML`) and Wikipedia; `npm run verify-line` re-checks it against live trains.
//
//                                              ┌─ Bayside ─ Sutton ─ Howth
//   Greystones ─ Bray ─ … ─ Connolly ─ … ─ Howth Junction
//                                              └─ Clongriffin ─ Portmarnock ─ Malahide
import type { RawTrainMovement } from './irishRailClient';
import type { Direction } from './types';

export type Branch = 'trunk' | 'howth' | 'malahide';

/** The shared section, south to north, ending at the junction. */
export const TRUNK = [
  'GSTNS', 'BRAY', 'WBROK', 'SKILL', 'KILNY', 'DLKEY', 'GLGRY', 'SCOVE', 'DLERY', 'SHILL', 'SEAPT', 'BROCK', 'BTSTN',
  'SIDNY', 'SMONT', 'LDWNE', 'GCDK', 'PERSE', 'TARA', 'CNLLY', 'CTARF', 'KLSTR', 'HTOWN', 'RAHNY', 'KBRCK', 'HWTHJ',
] as const;

export const JUNCTION = 'HWTHJ';

/** The two northern branches, from the junction outwards. */
export const BRANCHES = {
  howth: ['BYSDE', 'SUTTN', 'HOWTH'],
  malahide: ['GRGRD', 'PMNCK', 'MHIDE'],
} as const satisfies Record<Exclude<Branch, 'trunk'>, readonly string[]>;

/** Every DART station, north to south, with each branch grouped (Malahide branch, Howth branch, then the trunk). */
export const LINE_ORDER: string[] = [
  ...[...BRANCHES.malahide].reverse(),
  ...[...BRANCHES.howth].reverse(),
  ...[...TRUNK].reverse(),
];

/** A railway line: every route a train runs is a section of one of `paths` (each listed south to north). */
export interface Line {
  paths: string[][];
  /** Where trains in each direction finish their run, including turn-backs like Bray. */
  termini: Record<Direction, string[]>;
  /** Track run one way only, as [from, to] (the Luas Green line's city-centre loop). Trains never run it to → from. */
  oneWay?: [string, string][];
}

/** Whether trains run from `from` to the next station `to` (always, except against a one-way stretch). */
export function runsBetween(from: string, to: string, line: Line): boolean {
  const oneWay = line.oneWay ?? [];
  return !oneWay.some(([a, b]) => a === to && b === from) || oneWay.some(([a, b]) => a === from && b === to);
}

/** Whether trains run all the way from `from` to `to` along `path`, past no one-way stretch run the other way. */
function runsAlong(path: string[], from: string, to: string, line: Line): boolean {
  if (!line.oneWay?.length) return true;
  const i = path.indexOf(from);
  const j = path.indexOf(to);
  const step = j > i ? 1 : -1;
  for (let k = i; k !== j; k += step) if (!runsBetween(path[k]!, path[k + step]!, line)) return false;
  return true;
}

export const DART_LINE: Line = {
  // Malahide first, matching the map (Malahide branch on the left, Howth on the right), so Howth Junction's
  // "next station" links read Clongriffin, then Bayside.
  paths: [
    [...TRUNK, ...BRANCHES.malahide],
    [...TRUNK, ...BRANCHES.howth],
  ],
  termini: { Northbound: [BRANCHES.howth.at(-1)!, BRANCHES.malahide.at(-1)!], Southbound: ['BRAY', 'GSTNS'] },
};

/**
 * Dublin–Belfast Enterprise, south to north. Verified (Nov 2026) against the stop lists of five
 * Enterprise trains in both directions; none called at Lisburn or Lurgan.
 */
export const ENTERPRISE_LINE: Line = {
  paths: [['CNLLY', 'DGHDA', 'DDALK', 'NEWRY', 'PDOWN', 'BFSTC']],
  termini: { Northbound: ['BFSTC'], Southbound: ['CNLLY'] },
};

/**
 * Cork commuter, from Cobh and Midleton (south) through Cork Kent to Mallow (north); the two lines
 * meet at Glounthaune. Taken from the stop lists of Cork trains (Nov 2026). "Northbound" here means
 * towards Cork and Mallow. Many trains finish at Cork, like Bray on the DART.
 */
export const CORK_LINE: Line = {
  paths: [
    ['COBH', 'RBROK', 'CGLOE', 'FOTA', 'GHANE', 'LSLND', 'CORK', 'MLLOW'],
    ['MDLTN', 'CGTWL', 'GHANE', 'LSLND', 'CORK', 'MLLOW'],
  ],
  termini: { Northbound: ['CORK', 'MLLOW'], Southbound: ['COBH', 'MDLTN'] },
};

export function branchOf(code: string): Branch | undefined {
  if ((TRUNK as readonly string[]).includes(code)) return 'trunk';
  if ((BRANCHES.howth as readonly string[]).includes(code)) return 'howth';
  if ((BRANCHES.malahide as readonly string[]).includes(code)) return 'malahide';
  return undefined;
}

/**
 * Stations from `from` to `to` inclusive, in travel order. Undefined when no train runs between
 * them directly, e.g. between the DART's Howth and Malahide branches (change at Howth Junction).
 */
export function route(from: string, to: string, line: Line = DART_LINE): string[] | undefined {
  for (const path of line.paths) {
    const i = path.indexOf(from);
    const j = path.indexOf(to);
    if (i >= 0 && j >= 0) return i <= j ? path.slice(i, j + 1) : path.slice(j, i + 1).reverse();
  }
  return undefined;
}

export function stopsBetween(from: string, to: string, line: Line = DART_LINE): number | undefined {
  const r = route(from, to, line);
  return r && r.length - 1;
}

export function directionBetween(from: string, to: string, line: Line = DART_LINE): Direction | undefined {
  const r = route(from, to, line);
  if (!r || r.length < 2) return undefined;
  const path = line.paths.find((p) => p.includes(from) && p.includes(to))!;
  return path.indexOf(to) > path.indexOf(from) ? 'Northbound' : 'Southbound';
}

/** Whether a train now at `at` and running to `destination` will call at `stop` later on. */
export function callsAt(at: string, destination: string, stop: string, line: Line = DART_LINE): boolean {
  const r = route(at, destination, line);
  return !!r && stop !== at && r.includes(stop);
}

/** The next stations either side. On the DART, north of Howth Junction there are two: Bayside and Clongriffin. */
export function adjacentStations(code: string, line: Line = DART_LINE): { north: string[]; south: string[] } {
  const north = new Set<string>();
  const south = new Set<string>();
  for (const path of line.paths) {
    const i = path.indexOf(code);
    if (i < 0) continue;
    // A neighbour already on the other side stays there: where a route reverses at a station (Cork–Tralee
    // trains at Mallow), the first path's side wins, as it does for `directionBetween`.
    const after = path[i + 1];
    const before = path[i - 1];
    // Only where trains go from here: on a one-way stretch, the station they come from isn't a "next station".
    if (after && !south.has(after) && runsBetween(code, after, line)) north.add(after);
    if (before && !north.has(before) && runsBetween(code, before, line)) south.add(before);
  }
  return { north: [...north], south: [...south] };
}

/** The stations a train actually serves, in order: skips timing points (T) and cancelled stops (C). */
export function servedStops(movements: RawTrainMovement[]): string[] {
  return [...movements]
    .sort((a, b) => Number(a.LocationOrder) - Number(b.LocationOrder))
    .filter((m) => ['O', 'S', 'D'].includes(m.LocationType))
    .map((m) => m.LocationCode.trim())
    .filter((code, i, codes) => code !== codes[i - 1]);
}

/** Where trains in a direction can end up, e.g. Connolly northbound → Howth and Malahide. Empty at a terminus. */
export function terminiFrom(code: string, direction: Direction, line: Line = DART_LINE): string[] {
  // Each once: a route's branches can end at the same place (every InterCity route's paths start at Heuston).
  return [...new Set(line.termini[direction])].filter(
    (end) =>
      end !== code &&
      directionBetween(code, end, line) === direction &&
      // Reachable from here: not against a one-way stretch (from Westmoreland, no tram goes south).
      line.paths.some((p) => p.includes(code) && p.includes(end) && runsAlong(p, code, end, line)),
  );
}

/** Every station you can reach from `code` travelling in `direction`, in line order (nearest first on the trunk). */
export function stationsAhead(code: string, direction: Direction, line: Line = DART_LINE): string[] {
  return line.paths.flatMap((path) => {
    const i = path.indexOf(code);
    if (i < 0) return [];
    return direction === 'Northbound' ? path.slice(i + 1) : path.slice(0, i).reverse();
  }).filter((s, i, all) => all.indexOf(s) === i);
}
