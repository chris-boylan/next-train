// Builds the all-stations network map data from live trains.
// The API lists every station's location but not how stations connect, so this samples every train
// running now: each train's stop list includes stations it passes without stopping, so consecutive
// stations in it are neighbours on the track. Lines with no train running at the time are missed,
// so connections found in earlier runs are kept: run it at a few different times to fill gaps, and
// check the "unconnected" report. Pass --fresh to start over.
// It also reads Irish Rail's published GTFS timetable (every train's stops), which fills in lines with only a few
// trains a day (Nenagh, Limerick Junction–Waterford, Ennis–Athenry) whatever the time; --no-timetable skips it.
// Usage: npm run build-network -w @dart-times/core [-- --fresh] [-- --no-timetable]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { IrishRailClient } from '../src/irishRailClient';
import { ALL_STATIONS } from '../src/stations';
import { timetablePaths } from '../src/timetable';
import type { Station } from '../src/types';

const GTFS_URL = 'https://www.transportforireland.ie/transitData/Data/GTFS_Irish_Rail.zip';
const APP_CODES = new Set(ALL_STATIONS.map((s) => s.code));

const out = fileURLToPath(new URL('../../web/src/maps/data/network.data.ts', import.meta.url));
const client = new IrishRailClient({ timeoutMs: 15_000 });
const allStations = (await client.getAllStations()).map((s) => ({
  code: s.StationCode.trim(),
  name: s.StationDesc.trim(),
  lat: Number(s.StationLatitude),
  lon: Number(s.StationLongitude),
}));
const known = new Set(allStations.map((s) => s.code));

// Keep what earlier runs found, unless starting fresh.
const edges = new Set<string>();
if (!process.argv.includes('--fresh') && existsSync(out)) {
  const previous = readFileSync(out, 'utf8').match(/NETWORK_EDGES: \[string, string\]\[\] = (\[.*\]);/)?.[1];
  for (const [a, b] of previous ? (JSON.parse(previous) as [string, string][]) : []) edges.add(`${a}|${b}`);
}
const previousCount = edges.size;

const trains = await client.getCurrentTrains();
let sampled = 0;
for (const train of trains) {
  const movements = await client.getTrainMovements(train.TrainCode).catch(() => []);
  if (!movements.length) continue;
  sampled++;
  const path = [...movements]
    .sort((a, b) => Number(a.LocationOrder) - Number(b.LocationOrder))
    .map((m) => m.LocationCode.trim())
    .filter((code, i, all) => known.has(code) && code !== all[i - 1]);
  for (let i = 1; i < path.length; i++) {
    const pair = [path[i - 1]!, path[i]!].sort();
    edges.add(pair.join('|'));
  }
  await new Promise((r) => setTimeout(r, 200)); // go easy on the API
}

// Every train in the published timetable, whatever's running now. Its stop lists leave out stations trains pass,
// so links found only here are checked more loosely for skipped stations below.
let timetabled = 0;
const fromTimetable = new Set<string>();
if (!process.argv.includes('--no-timetable')) {
  const res = await fetch(GTFS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GTFS download failed: HTTP ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()), { filter: (f) => f.name === 'stops.txt' || f.name === 'stop_times.txt' });
  // The API's own station list (codes and positions) for matching the timetable's stops to stations; not its
  // all-capitals entries ("PARK WEST"), which are junctions or duplicates of a real station.
  const located = allStations
    .filter((s) => s.lat !== 0 && s.lon !== 0 && s.name !== s.name.toUpperCase())
    .map((s) => ({ code: s.code, name: s.name, shortName: s.name, aliases: [], branch: 'trunk', lat: s.lat, lon: s.lon }) as Station);
  for (const path of timetablePaths({ stops: strFromU8(zip['stops.txt']!), stopTimes: strFromU8(zip['stop_times.txt']!) }, located)) {
    timetabled++;
    for (let i = 1; i < path.length; i++) {
      const pair = [path[i - 1]!, path[i]!].sort().join('|');
      if (!edges.has(pair)) fromTimetable.add(pair);
      edges.add(pair);
    }
  }
}

// The API lists some stations several times under different codes (e.g. Hazelhatch as HZLCH, HAZEF
// and HAZES), and different trains report different ones. Merge each name onto its busiest code.
const uses = new Map<string, number>();
for (const code of [...edges].flatMap((e) => e.split('|'))) uses.set(code, (uses.get(code) ?? 0) + 1);
const canonical = new Map<string, string>();
for (const s of allStations) {
  const sameName = allStations.filter((o) => o.name.toLowerCase() === s.name.toLowerCase());
  // The app's own code where it has one (CHORC, not the timetable's favourite PWESF), else the busiest.
  const own = sameName.find((o) => APP_CODES.has(o.code));
  const best = own ?? sameName.reduce((a, o) => ((uses.get(o.code) ?? 0) > (uses.get(a.code) ?? 0) ? o : a));
  canonical.set(s.code, best.code);
}
const merged = new Set<string>();
const canon = (e: string) => {
  const [a, b] = e.split('|').map((c) => canonical.get(c) ?? c) as [string, string];
  return a === b ? undefined : [a, b].sort().join('|');
};
for (const e of edges) {
  const c = canon(e);
  if (c) merged.add(c);
}
// Links the timetable alone gave, under the merged codes (a live train or an earlier run may have the same one).
const timetableOnly = new Set([...fromTimetable].map(canon).filter((e): e is string => !!e));
for (const e of edges) if (!fromTimetable.has(e)) timetableOnly.delete(canon(e) ?? '');

// A train whose stop list leaves out a station (e.g. new Woodbrook, or any express in the timetable, which lists
// only its stops: Heuston to Kildare skips nine) adds a direct link that skips them. Drop a link A–C when the
// other links already join A to C through stations lying (roughly) between them: a route at most 15% (or 1 km)
// longer. Out of town (over 10 km), or a link only the timetable has, it may detour more (60%): trains run in
// and out of Kilkenny, so Muine Bheag–Thomastown (the timetable, and the Lavistown loop) skips a station well
// off the straight line.
const position = new Map(allStations.filter((s) => s.lat !== 0).map((s) => [s.code, { lat: s.lat, lon: s.lon }]));
// A station the API gives no position (Moira) sits, for now, midway between its neighbours, so a link that
// skips it (Lisburn–Lurgan, from the timetable) is still seen as skipping a station.
for (const s of allStations.filter((s) => s.lat === 0)) {
  const around = [...merged]
    .map((e) => e.split('|'))
    .filter((pair) => pair.includes(s.code))
    .map((pair) => position.get(pair[0] === s.code ? pair[1]! : pair[0]!))
    .filter((p): p is { lat: number; lon: number } => !!p);
  if (around.length >= 2) {
    position.set(s.code, { lat: around.reduce((t, p) => t + p.lat, 0) / around.length, lon: around.reduce((t, p) => t + p.lon, 0) / around.length });
  }
}
const km = (a: string, b: string) => {
  const p = position.get(a);
  const q = position.get(b);
  if (!p || !q) return undefined;
  const x = (q.lon - p.lon) * Math.cos(((p.lat + q.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, q.lat - p.lat) * 111;
};
const neighbours = new Map<string, Set<string>>();
for (const e of merged) {
  const [a, b] = e.split('|') as [string, string];
  (neighbours.get(a) ?? neighbours.set(a, new Set()).get(a)!).add(b);
  (neighbours.get(b) ?? neighbours.set(b, new Set()).get(b)!).add(a);
}
/** Shortest track distance from `a` to `c` without the direct link, giving up past `limit` km. */
function around(a: string, c: string, limit: number): number | undefined {
  const best = new Map([[a, 0]]);
  const queue: [string, number][] = [[a, 0]];
  while (queue.length) {
    queue.sort((x, y) => x[1] - y[1]);
    const [here, dist] = queue.shift()!;
    if (here === c) return dist;
    if (dist > (best.get(here) ?? Infinity)) continue;
    for (const next of neighbours.get(here) ?? []) {
      if (here === a && next === c) continue;
      const step = km(here, next);
      if (step === undefined) continue;
      const d = dist + step;
      if (d <= limit && d < (best.get(next) ?? Infinity)) {
        best.set(next, d);
        queue.push([next, d]);
      }
    }
  }
  return undefined;
}
// Longest links first, so a long express link is judged against the local track, not other express links.
for (const e of [...merged].sort((x, y) => (km(...(y.split('|') as [string, string])) ?? 0) - (km(...(x.split('|') as [string, string])) ?? 0))) {
  const [a, c] = e.split('|') as [string, string];
  const direct = km(a, c);
  if (direct === undefined) continue;
  const limit = Math.max(direct * (timetableOnly.has(e) || direct > 10 ? 1.6 : 1.15), direct + 1);
  if (around(a, c, limit) !== undefined) {
    merged.delete(e);
    neighbours.get(a)!.delete(c);
    neighbours.get(c)!.delete(a);
  }
}
edges.clear();
for (const e of merged) edges.add(e);

const connected = new Set([...edges].flatMap((e) => e.split('|')));

// After merging, leave out the unused duplicate codes. The API's all-capitals entries (e.g.
// "CITY JUNCTION", "PARK WEST") are junctions or duplicates, so they're dropped unless trains use them.
const stations = allStations.filter((s) => {
  if (connected.has(s.code)) return true;
  if (s.name === s.name.toUpperCase()) return false;
  const sameName = allStations.filter((o) => o.name.toLowerCase() === s.name.toLowerCase());
  return !sameName.some((o) => connected.has(o.code)) && sameName[0] === s;
});
const unconnected = stations.filter((s) => !connected.has(s.code));

// Some API entries have no position (0, 0, e.g. Moira). Place them at the midpoint of their track
// neighbours, and drop them if they have none.
const located = (s: { lat: number; lon: number }) => s.lat !== 0 && s.lon !== 0;
const byCode = new Map(stations.map((s) => [s.code, s]));
const approximate: string[] = [];
for (const s of stations.filter((s) => !located(s))) {
  const neighbours = [...edges]
    .map((e) => e.split('|'))
    .filter((pair) => pair.includes(s.code))
    .map((pair) => byCode.get(pair[0] === s.code ? pair[1]! : pair[0]!)!)
    .filter(located);
  if (!neighbours.length) continue;
  s.lat = neighbours.reduce((sum, n) => sum + n.lat, 0) / neighbours.length;
  s.lon = neighbours.reduce((sum, n) => sum + n.lon, 0) / neighbours.length;
  approximate.push(s.name);
}
const mapped = stations.filter(located);
writeFileSync(
  out,
  `// Generated by packages/core/scripts/build-network.ts from ${sampled} live trains${timetabled ? ` and ${timetabled} timetabled trips` : ''} on ${new Date().toISOString()}.
// Do not edit by hand. Stations with no edges had no train through them when this was generated.
export interface NetworkStation {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export const NETWORK_STATIONS: NetworkStation[] = ${JSON.stringify(mapped)};

/** Neighbouring stations on the track, as [code, code] pairs. */
export const NETWORK_EDGES: [string, string][] = ${JSON.stringify([...edges].sort().map((e) => e.split('|')))};
`,
);
console.log(`${stations.length} stations (from ${allStations.length} API entries), ${edges.size} connections`);
const change = edges.size - previousCount;
console.log(`(net ${change >= 0 ? '+' : ''}${change} after cleanup, from ${sampled}/${trains.length} trains sampled now) → ${out}`);
console.log(`Unconnected (${unconnected.length}): ${unconnected.map((s) => s.name).join(', ')}`);
console.log(`Position estimated from neighbours (${approximate.length}): ${approximate.join(', ') || 'none'}`);
const dropped = stations.filter((s) => !located(s));
if (dropped.length) console.log(`No position, left off the map: ${dropped.map((s) => s.name).join(', ')}`);
