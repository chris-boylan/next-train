/** Dublin commuter routes as drawn on the map: core's route lines plus a colour each. */
import { COMMUTER_ROUTES, type CommuterRouteId } from '@dart-times/core';

export interface CommuterMapRoute {
  id: CommuterRouteId;
  colour: string;
  /** Where the route starts (city end) for its own map. */
  root: string;
  edges: [string, string][];
}

// Distinct colours so the routes can be told apart on the combined map.
const COLOURS: Record<CommuterRouteId, string> = {
  northern: '#00897b',
  western: '#3f51b5',
  southWestern: '#c27c0e',
  southEastern: '#8d6e63',
};

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/** Each connection once, from a route's paths. */
function edgesOf(paths: string[][]): [string, string][] {
  const unique = new Map<string, [string, string]>();
  for (const path of paths) for (let i = 1; i < path.length; i++) unique.set(pairKey(path[i - 1]!, path[i]!), [path[i - 1]!, path[i]!]);
  return [...unique.values()];
}

export const COMMUTER_MAP_ROUTES: CommuterMapRoute[] = COMMUTER_ROUTES.map((r) => ({
  id: r.id,
  colour: COLOURS[r.id],
  root: r.line.paths[0]![0]!,
  edges: edgesOf(r.line.paths),
}));

/** Every connection on any commuter route, for the combined map. */
export const ALL_COMMUTER_EDGES: [string, string][] = edgesOf(COMMUTER_ROUTES.flatMap((r) => r.line.paths));

export function routeColour(id: CommuterRouteId): string {
  return COLOURS[id];
}

/** The colours of every route using a connection (in COMMUTER_ROUTES order), so shared track shows them all. */
export function routeColoursOf(a: string, b: string): string[] {
  return COMMUTER_MAP_ROUTES.filter((r) => r.edges.some((e) => pairKey(...e) === pairKey(a, b))).map((r) => r.colour);
}
