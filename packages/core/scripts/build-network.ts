// Builds the all-stations network map data from live trains.
// The API lists every station's location but not how stations connect, so this samples every train
// running now: each train's stop list includes stations it passes without stopping, so consecutive
// stations in it are neighbours on the track. Lines with no train running at the time are missed,
// so connections found in earlier runs are kept: run it at a few different times to fill gaps, and
// check the "unconnected" report. Pass --fresh to start over.
// Usage: npm run build-network -w @dart-times/core [-- --fresh]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IrishRailClient } from '../src/irishRailClient';

const out = fileURLToPath(new URL('../../web/src/network.data.ts', import.meta.url));
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

// The API lists some stations several times under different codes (e.g. Hazelhatch as HZLCH, HAZEF
// and HAZES), and different trains report different ones. Merge each name onto its busiest code.
const uses = new Map<string, number>();
for (const code of [...edges].flatMap((e) => e.split('|'))) uses.set(code, (uses.get(code) ?? 0) + 1);
const canonical = new Map<string, string>();
for (const s of allStations) {
  const sameName = allStations.filter((o) => o.name.toLowerCase() === s.name.toLowerCase());
  const best = sameName.reduce((a, o) => ((uses.get(o.code) ?? 0) > (uses.get(a.code) ?? 0) ? o : a));
  canonical.set(s.code, best.code);
}
const merged = new Set<string>();
for (const e of edges) {
  const [a, b] = e.split('|').map((c) => canonical.get(c) ?? c) as [string, string];
  if (a !== b) merged.add([a, b].sort().join('|'));
}

// A train whose stop list leaves out a station (e.g. new Woodbrook) adds a direct link that skips it.
// Drop a link A–C when there's a station B with links A–B and B–C lying (roughly) between them.
const position = new Map(allStations.filter((s) => s.lat !== 0).map((s) => [s.code, s]));
const km = (a: string, b: string) => {
  const p = position.get(a);
  const q = position.get(b);
  if (!p || !q) return undefined;
  const x = (q.lon - p.lon) * Math.cos(((p.lat + q.lat) / 2) * (Math.PI / 180));
  return Math.hypot(x, q.lat - p.lat) * 111;
};
const linked = (a: string, b: string) => merged.has([a, b].sort().join('|'));
for (const e of [...merged]) {
  const [a, c] = e.split('|') as [string, string];
  const direct = km(a, c);
  if (direct === undefined) continue;
  const via = [...position.keys()].find((b) => {
    if (b === a || b === c || !linked(a, b) || !linked(b, c)) return false;
    const around = (km(a, b) ?? Infinity) + (km(b, c) ?? Infinity);
    return around <= direct * 1.15;
  });
  if (via) merged.delete(e);
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
  `// Generated by packages/core/scripts/build-network.ts from ${sampled} live trains on ${new Date().toISOString()}.
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
