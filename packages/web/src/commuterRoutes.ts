/**
 * Dublin commuter routes for the preview map, traced through the track connections recorded from live
 * trains (network.data.ts): each route is the shortest run of track between its ends. Not yet verified
 * against live commuter trains, and not used for live times.
 */
import { NETWORK_EDGES } from './network.data';

export type CommuterRouteId = 'northern' | 'western' | 'southWestern' | 'southEastern';

export interface CommuterRoute {
  id: CommuterRouteId;
  /** Provisional colours for telling routes apart on the combined preview. */
  colour: string;
  /** Where the route starts (city end) for its own map. */
  root: string;
  edges: [string, string][];
}

// [from, to] runs making up each route, city end first.
const RUNS: Record<CommuterRouteId, { colour: string; runs: [string, string][] }> = {
  northern: { colour: '#00897b', runs: [['CNLLY', 'DDALK']] },
  western: {
    colour: '#3f51b5',
    runs: [
      ['CNLLY', 'MYNTH'],
      ['DCKLS', 'BBRDG'],
      ['CLSLA', 'M3WAY'],
    ],
  },
  southWestern: {
    colour: '#c27c0e',
    runs: [
      ['HSTON', 'KDARE'],
      ['GCDK', 'CNLLY'],
      ['CNLLY', 'CHORC'],
    ],
  },
  southEastern: { colour: '#8d6e63', runs: [['CNLLY', 'GOREY']] },
};

const neighbours = new Map<string, string[]>();
for (const [a, b] of NETWORK_EDGES) {
  neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
}

/** Shortest run of recorded track between two stations, as consecutive [a, b] pairs. */
function trace(from: string, to: string): [string, string][] {
  const previous = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const code = queue.shift()!;
    if (code === to) break;
    for (const next of neighbours.get(code) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, code);
      queue.push(next);
    }
  }
  if (!previous.has(to)) throw new Error(`No recorded track from ${from} to ${to}`);
  const pairs: [string, string][] = [];
  for (let code = to; code !== from; code = previous.get(code)!) pairs.unshift([previous.get(code)!, code]);
  return pairs;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export const COMMUTER_ROUTES: CommuterRoute[] = (Object.keys(RUNS) as CommuterRouteId[]).map((id) => {
  const unique = new Map<string, [string, string]>();
  for (const [from, to] of RUNS[id].runs) for (const pair of trace(from, to)) unique.set(pairKey(...pair), pair);
  return { id, colour: RUNS[id].colour, root: RUNS[id].runs[0]![0], edges: [...unique.values()] };
});

/** Every connection on any commuter route, for the combined map. */
export const ALL_COMMUTER_EDGES: [string, string][] = [
  ...new Map(COMMUTER_ROUTES.flatMap((r) => r.edges.map((e): [string, [string, string]] => [pairKey(...e), e]))).values(),
];

/** The first route (in the order above) that uses a connection, for colouring the combined map. */
export function routeOf(a: string, b: string): CommuterRoute | undefined {
  return COMMUTER_ROUTES.find((r) => r.edges.some((e) => pairKey(...e) === pairKey(a, b)));
}
