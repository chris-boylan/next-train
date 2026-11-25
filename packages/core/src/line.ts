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
}

export const DART_LINE: Line = {
  paths: [
    [...TRUNK, ...BRANCHES.howth],
    [...TRUNK, ...BRANCHES.malahide],
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
    if (i < path.length - 1) north.add(path[i + 1]!);
    if (i > 0) south.add(path[i - 1]!);
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
  return line.termini[direction].filter((end) => end !== code && directionBetween(code, end, line) === direction);
}

/** Every station you can reach from `code` travelling in `direction`, in line order (nearest first on the trunk). */
export function stationsAhead(code: string, direction: Direction, line: Line = DART_LINE): string[] {
  return line.paths.flatMap((path) => {
    const i = path.indexOf(code);
    if (i < 0) return [];
    return direction === 'Northbound' ? path.slice(i + 1) : path.slice(0, i).reverse();
  }).filter((s, i, all) => all.indexOf(s) === i);
}
