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

/** Southern terminus to the end of a branch: every route a DART can run is a section of one of these. */
const PATHS: string[][] = [
  [...TRUNK, ...BRANCHES.howth],
  [...TRUNK, ...BRANCHES.malahide],
];

export function branchOf(code: string): Branch | undefined {
  if ((TRUNK as readonly string[]).includes(code)) return 'trunk';
  if ((BRANCHES.howth as readonly string[]).includes(code)) return 'howth';
  if ((BRANCHES.malahide as readonly string[]).includes(code)) return 'malahide';
  return undefined;
}

/**
 * Stations from `from` to `to` inclusive, in travel order. Undefined when no DART runs between
 * them directly, i.e. between the Howth and Malahide branches (change at Howth Junction).
 */
export function route(from: string, to: string): string[] | undefined {
  for (const path of PATHS) {
    const i = path.indexOf(from);
    const j = path.indexOf(to);
    if (i >= 0 && j >= 0) return i <= j ? path.slice(i, j + 1) : path.slice(j, i + 1).reverse();
  }
  return undefined;
}

export function stopsBetween(from: string, to: string): number | undefined {
  const r = route(from, to);
  return r && r.length - 1;
}

export function directionBetween(from: string, to: string): Direction | undefined {
  const r = route(from, to);
  if (!r || r.length < 2) return undefined;
  const path = PATHS.find((p) => p.includes(from) && p.includes(to))!;
  return path.indexOf(to) > path.indexOf(from) ? 'Northbound' : 'Southbound';
}

/** Whether a train now at `at` and running to `destination` will call at `stop` later on. */
export function callsAt(at: string, destination: string, stop: string): boolean {
  const r = route(at, destination);
  return !!r && stop !== at && r.includes(stop);
}

/** The next stations either side. North of the junction there are two: Bayside and Clongriffin. */
export function adjacentStations(code: string): { north: string[]; south: string[] } {
  const trunk = TRUNK as readonly string[];
  const t = trunk.indexOf(code);
  if (t >= 0) {
    return {
      north: code === JUNCTION ? [BRANCHES.howth[0], BRANCHES.malahide[0]] : [trunk[t + 1]!],
      south: t > 0 ? [trunk[t - 1]!] : [],
    };
  }
  for (const branch of Object.values(BRANCHES) as readonly (readonly string[])[]) {
    const b = branch.indexOf(code);
    if (b >= 0) {
      return { north: b < branch.length - 1 ? [branch[b + 1]!] : [], south: [b > 0 ? branch[b - 1]! : JUNCTION] };
    }
  }
  return { north: [], south: [] };
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
export function terminiFrom(code: string, direction: Direction): string[] {
  const ends = direction === 'Northbound' ? [BRANCHES.howth.at(-1)!, BRANCHES.malahide.at(-1)!] : ['BRAY', 'GSTNS'];
  return ends.filter((end) => end !== code && directionBetween(code, end) === direction);
}
