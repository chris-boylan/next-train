/**
 * Line colours for the all-stations map: each piece of track in the colour of the services that use it, the
 * same colours as their tiles. Track shared by several services shows each one's colour side by side.
 *
 * Services' lines skip stations (InterCity trains run Heuston–Kildare non-stop), so each connection is
 * traced along the map's track to colour every piece it runs over.
 */
import { COMMUTER_ROUTES, CORK_LINE, DART_LINE, ENTERPRISE_LINE, INTERCITY_ROUTES, type Line } from '@dart-times/core';

export type MapService = 'dart' | 'commuter' | 'intercity' | 'cork' | 'enterprise' | 'ni';

/** CSS variables (styles.css), so each colour can be lightened for dark mode. In stripe order. */
export const SERVICE_LINE_COLOURS: Record<MapService, string> = {
  dart: 'var(--svc-dart)',
  commuter: 'var(--svc-commuter)',
  intercity: 'var(--svc-intercity)',
  cork: 'var(--svc-cork)',
  enterprise: 'var(--svc-enterprise)',
  ni: 'var(--svc-ni)',
};

const SERVICE_LINES: [MapService, Line[]][] = [
  ['dart', [DART_LINE]],
  ['commuter', COMMUTER_ROUTES.map((r) => r.line)],
  ['intercity', INTERCITY_ROUTES.map((r) => r.line)],
  ['cork', [CORK_LINE]],
  ['enterprise', [ENTERPRISE_LINE]],
];

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/** The shortest run of track from `a` to `b`, ends included. */
function trackBetween(adjacent: Map<string, string[]>, a: string, b: string): string[] | undefined {
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

/**
 * The services using each piece of track on the map. `northern` marks Northern Ireland stations: track
 * between two of them is also NI Railways' (shown muted, as it has no live times yet).
 */
export function servicesByTrack(edges: [string, string][], northern: (code: string) => boolean): Map<string, MapService[]> {
  const adjacent = new Map<string, string[]>();
  for (const [a, b] of edges) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  const uses = new Map<string, Set<MapService>>();
  const mark = (a: string, b: string, service: MapService) => {
    const key = pairKey(a, b);
    uses.set(key, (uses.get(key) ?? new Set()).add(service));
  };
  for (const [service, lines] of SERVICE_LINES) {
    for (const path of lines.flatMap((l) => l.paths)) {
      for (let i = 1; i < path.length; i++) {
        const track = trackBetween(adjacent, path[i - 1]!, path[i]!);
        for (let j = 1; j < (track?.length ?? 0); j++) mark(track![j - 1]!, track![j]!, service);
      }
    }
  }
  for (const [a, b] of edges) if (northern(a) && northern(b)) mark(a, b, 'ni');
  const order = Object.keys(SERVICE_LINE_COLOURS) as MapService[];
  return new Map([...uses].map(([key, set]) => [key, order.filter((s) => set.has(s))]));
}

/** Colours for a piece of track, for PositionedMap's colourOf; undefined for track no service uses. */
export function trackColours(byTrack: Map<string, MapService[]>, a: string, b: string): string[] | undefined {
  const services = byTrack.get(pairKey(a, b));
  return services?.length ? services.map((s) => SERVICE_LINE_COLOURS[s]) : undefined;
}
