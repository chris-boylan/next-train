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
import type { Schematic, SchematicPoint } from './schematics';

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

  // Each InterCity connection follows the all-stations map's track, through any stations it skips.
  const adjacent = new Map<string, string[]>();
  for (const [a, b] of MAP_EDGES) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  const bends: Record<string, Point[]> = {};
  for (const [a, b] of routeMap.allEdges) {
    const path = points[a] && points[b] ? networkPath(adjacent, a, b) : undefined;
    if (!path) continue;
    const corners: Point[] = [];
    for (let i = 1; i < path.length; i++) {
      corners.push(...bendsBetween(path[i - 1]!, path[i]!));
      const via = network.points[path[i]!];
      if (i < path.length - 1 && via) corners.push([via.x, via.y]);
    }
    if (corners.length) bends[`${a}|${b}`] = corners;
  }

  // Lift everything to the top of this service's network (the all-stations map starts with NI at the top).
  const ys = [...Object.values(points).map((p) => p.y), ...Object.values(bends).flat().map(([, y]) => y)];
  const lift = Math.min(...ys) - 40;
  return {
    width: network.width,
    height: Math.max(...ys) - lift + 50,
    points: Object.fromEntries(Object.entries(points).map(([code, p]) => [code, { ...p, y: p.y - lift }])),
    bends: Object.fromEntries(Object.entries(bends).map(([key, cs]) => [key, cs.map(([x, y]): Point => [x, y - lift])])),
    labelMaxWidth: network.labelMaxWidth,
  };
}
