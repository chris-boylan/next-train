/**
 * The InterCity map, drawn from the all-stations map (networkSchematic.ts) so the two look alike: every
 * station keeps its place and label there, and each InterCity connection follows the same track shape.
 *
 * InterCity trains skip most Dublin commuter stations, so a connection such as Heuston–Kildare runs through
 * stations the InterCity map doesn't show; those stations' positions become corners of the line.
 *
 * Stations the all-stations map doesn't place yet (the Nenagh line, Gort–Craughwell and Limerick Junction–
 * Waterford had no train seen on them when it was built) are left out here too; the map lists them, and
 * they're on the route maps. They appear here as soon as the all-stations map places them.
 */
import { INTERCITY_STATION_CODES, NIR_STATION_CODES } from '@dart-times/core';
import { INTERCITY_ROUTE_MAP } from './intercityRoutes';
import { NIR_ROUTE_MAP } from './nirRoutes';
import type { RouteMap } from './routeMaps';
import { MAP_EDGES } from '../NetworkMap';
import { networkSchematic } from './networkSchematic';
import { type Schematic, type SchematicPoint, withStandIns } from './schematics';

type Point = [number, number];

/** The shortest run of track from `a` to `b` on the all-stations map, ends included. */
function networkPath(adjacent: Map<string, string[]>, a: string, b: string): string[] | undefined {
  const previous = new Map<string, string>([[a, a]]);
  const queue = [a];
  while (queue.length && !previous.has(b)) {
    const here = queue.shift()!;
    for (const next of adjacent.get(here) ?? []) {
      if (!previous.has(next)) {
        previous.set(next, here);
        queue.push(next);
      }
    }
  }
  if (!previous.has(b)) return undefined;
  const path = [b];
  while (path[0] !== a) path.unshift(previous.get(path[0]!)!);
  return path;
}

export function intercitySchematic(lang: 'en' | 'ga' = 'en'): Schematic {
  return schematicFromNetwork(INTERCITY_STATION_CODES, INTERCITY_ROUTE_MAP, lang);
}

/** The Translink NIR map, drawn from the all-stations map's Northern Ireland the same way. */
export function nirSchematic(lang: 'en' | 'ga' = 'en'): Schematic {
  return schematicFromNetwork(NIR_STATION_CODES, NIR_ROUTE_MAP, lang);
}

/** A service's map from the all-stations map: its stations where they sit there, its connections along its track. */
function schematicFromNetwork(codes: string[], routeMap: Pick<RouteMap, 'allEdges'>, lang: 'en' | 'ga'): Schematic {
  const network = networkSchematic(lang);
  const networkBends = network.bends ?? {};
  const bendsBetween = (a: string, b: string): Point[] =>
    networkBends[`${a}|${b}`] ?? [...(networkBends[`${b}|${a}`] ?? [])].reverse();

  const points: Record<string, SchematicPoint> = {};
  for (const code of codes) {
    const p = network.points[code];
    if (p) points[code] = { ...p };
  }
  // The all-stations map's stand-in stops (the Nenagh line's Ballybrophy), where this service uses their link.
  const linkKeys = new Set(routeMap.allEdges.map(([a, b]) => [a, b].sort().join('|')));
  const standIns = (network.standIns ?? []).filter((s) => linkKeys.has([...s.link].sort().join('|')) && network.points[s.code]);
  for (const s of standIns) points[s.code] = { ...network.points[s.code]! };

  // Each InterCity connection follows the all-stations map's track, through any stations it skips.
  const adjacent = new Map<string, string[]>();
  for (const [a, b] of MAP_EDGES) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  const bends: Record<string, Point[]> = {};
  for (const [a, b] of withStandIns(routeMap.allEdges, standIns)) {
    const path = points[a] && points[b] ? networkPath(adjacent, a, b) : undefined;
    if (!path) continue;
    const corners: Point[] = [];
    for (let i = 1; i < path.length; i++) {
      corners.push(...bendsBetween(path[i - 1]!, path[i]!));
      const via = network.points[path[i]!];
      if (i < path.length - 1 && via) corners.push([via.x, via.y]);
    }
    // Copies (connections can share the all-stations map's corners, and squeezing moves each once), keeping only
    // real corners: the stations it skips on a straight run aren't corners, and would stop the run being squeezed.
    const from = [points[a]!.x, points[a]!.y] as Point;
    const to = [points[b]!.x, points[b]!.y] as Point;
    const kept = corners.filter((c, k) => {
      const before = k === 0 ? from : corners[k - 1]!;
      const after = k === corners.length - 1 ? to : corners[k + 1]!;
      return (c[0] - before[0]) * (after[1] - c[1]) !== (c[1] - before[1]) * (after[0] - c[0]);
    });
    if (kept.length) bends[`${a}|${b}`] = kept.map(([x, y]): Point => [x, y]);
  }

  squeezeEmptyBands(points, bends, routeMap.allEdges, standIns);

  // Lift everything to the top of this service's network (the all-stations map starts with NI at the top).
  const ys = [...Object.values(points).map((p) => p.y), ...Object.values(bends).flat().map(([, y]) => y)];
  const lift = Math.min(...ys) - 40;
  return {
    width: network.width,
    height: Math.max(...ys) - lift + 50,
    points: Object.fromEntries(Object.entries(points).map(([code, p]) => [code, { ...p, y: p.y - lift }])),
    bends: Object.fromEntries(Object.entries(bends).map(([key, cs]) => [key, cs.map(([x, y]): Point => [x, y - lift])])),
    labelMaxWidth: network.labelMaxWidth,
    standIns,
  };
}

/** The tallest a band with no stations or corners may be, on a service's own map. */
const MAX_EMPTY_BAND = 72;

/**
 * Shortens tall empty bands: a service's map keeps only its own stations, so where it skips the all-stations map's
 * (Sligo trains run non-stop from Drumcondra to Maynooth), its lines run a long way with nothing on them. A band
 * between two heights with no station or corner in it, crossed only by lines running straight up and down, is
 * cut down to MAX_EMPTY_BAND, moving everything below it up. Diagonals are never stretched or squashed.
 */
function squeezeEmptyBands(
  points: Record<string, SchematicPoint>,
  bends: Record<string, Point[]>,
  edges: [string, string][],
  standIns: { code: string; for: string; link: [string, string] }[],
) {
  const at = (code: string): Point | undefined => (points[code] ? [points[code]!.x, points[code]!.y] : undefined);
  const lines: Point[][] = withStandIns(edges, standIns).flatMap(([a, b]) => {
    const from = at(a);
    const to = at(b);
    if (!from || !to) return [];
    return [[from, ...(bends[`${a}|${b}`] ?? [...(bends[`${b}|${a}`] ?? [])].reverse()), to]];
  });
  const heights = [...new Set([...Object.values(points).map((p) => p.y), ...lines.flat().map(([, y]) => y)])].sort((a, b) => a - b);
  // From the bottom up, so each cut only moves what's below it.
  for (let i = heights.length - 1; i > 0; i--) {
    const top = heights[i - 1]!;
    const bottom = heights[i]!;
    const cut = bottom - top - MAX_EMPTY_BAND;
    if (cut <= 0) continue;
    const straight = lines.every((line) =>
      line.slice(1).every(([x, y], j) => {
        const [px, py] = line[j]!;
        const crosses = Math.min(py, y) <= top && Math.max(py, y) >= bottom;
        return !crosses || px === x;
      }),
    );
    if (!straight) continue;
    for (const p of Object.values(points)) if (p.y >= bottom) p.y -= cut;
    for (const corners of Object.values(bends)) for (const c of corners) if (c[1] >= bottom) c[1] -= cut;
  }
}
