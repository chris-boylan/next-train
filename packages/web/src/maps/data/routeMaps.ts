/** Routes as drawn on a service's map (Dublin Commuter, Intercity): each core route's connections plus a colour. */
import type { Line } from '@dart-times/core';

export interface MapRoute<Id extends string = string> {
  id: Id;
  colour: string;
  /** Where the route starts, for its own map. */
  root: string;
  edges: [string, string][];
}

export interface RouteMap<Id extends string = string> {
  routes: MapRoute<Id>[];
  /** Every connection on any route, each once, for the combined map. */
  allEdges: [string, string][];
  colour: (id: Id) => string;
  /** The colours of every route using a connection (in route order), so shared track shows them all. */
  coloursOf: (a: string, b: string) => string[];
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/** Each connection once, from a route's paths. */
function edgesOf(paths: string[][]): [string, string][] {
  const unique = new Map<string, [string, string]>();
  for (const path of paths) for (let i = 1; i < path.length; i++) unique.set(pairKey(path[i - 1]!, path[i]!), [path[i - 1]!, path[i]!]);
  return [...unique.values()];
}

/**
 * `stripeOrder` sets the order of the stripes where routes share track (first is drawn on the left of the
 * path's direction, so east of a line heading down the map); the legend keeps the routes' own order.
 */
export function buildRouteMap<Id extends string>(
  routes: { id: Id; line: Line }[],
  colours: Record<Id, string>,
  stripeOrder: Id[] = routes.map((r) => r.id),
): RouteMap<Id> {
  const mapRoutes = routes.map((r) => ({ id: r.id, colour: colours[r.id], root: r.line.paths[0]![0]!, edges: edgesOf(r.line.paths) }));
  const keys = mapRoutes.map((r) => new Set(r.edges.map((e) => pairKey(...e))));
  const rank = (id: Id) => (stripeOrder.includes(id) ? stripeOrder.indexOf(id) : stripeOrder.length);
  return {
    routes: mapRoutes,
    allEdges: edgesOf(routes.flatMap((r) => r.line.paths)),
    colour: (id) => colours[id],
    coloursOf: (a, b) =>
      mapRoutes
        .filter((_, i) => keys[i]!.has(pairKey(a, b)))
        .sort((x, y) => rank(x.id) - rank(y.id))
        .map((r) => r.colour),
  };
}
