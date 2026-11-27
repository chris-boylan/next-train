import { branchOf, CORK_LINE, ENTERPRISE_LINE, LINE_ORDER } from './line';
import type { Station } from './types';
import { DART_STATION_DATA } from './stations.data';
import { COMMUTER_STATION_DATA } from './stations.commuter.data';
import { CORK_STATION_DATA } from './stations.cork.data';
import { ENTERPRISE_STATION_DATA } from './stations.enterprise.data';
import { INTERCITY_STATION_DATA } from './stations.intercity.data';
import { NIR_STATION_DATA } from './stations.nir.data';
import { IRISH_NAMES } from './stations.ga';

export interface StationRecord {
  code: string;
  name: string;
  /** Alias from the API, sometimes with a parenthesised alternative, e.g. `Monkstown ( Salthill )`. */
  apiAlias: string;
  lat: number;
  lon: number;
}

// The station's own name where Irish Rail's API still uses an older or shorter one. Belfast's station has been
// Belfast Grand Central since it replaced Great Victoria Street in 2025; the API still calls it "Belfast".
const DISPLAY_NAMES: Record<string, string> = {
  BFSTC: 'Belfast Grand Central',
};

// Stations' official commemorative names (most from the 1966 renaming after the 1916 leaders): "Cork" is Kent
// Station, "Galway" is Ceannt Station. Irish Rail's live data and boards use the place name, so the app does too,
// shows the official name as a subtitle, and finds the station by it. Dublin's Heuston, Connolly and Pearse aren't
// listed: their official name is already the one shown.
const OFFICIAL_NAMES: Record<string, string> = {
  DLERY: 'Mallin',
  BRAY: 'Daly',
  DGHDA: 'MacBride',
  DDALK: 'Clarke',
  CORK: 'Kent',
  LMRCK: 'Colbert',
  GALWY: 'Ceannt',
  SLIGO: 'Mac Diarmada',
  WFORD: 'Plunkett',
  KKNNY: 'MacDonagh',
  WXFRD: "O'Hanrahan",
  TRLEE: 'Casement',
};

/** Search terms for an official name: "Kent", "Kent Station", "Cork Kent". */
function officialAliases(code: string, place: string): string[] {
  const official = OFFICIAL_NAMES[code];
  return official ? [official, `${official} Station`, `${place} ${official}`] : [];
}

// Names people (and Alexa's speech recognition) use that the API doesn't know about.
const EXTRA_ALIASES: Record<string, string[]> = {
  CNLLY: ['Connolly Station', 'Amiens Street'],
  TARA: ['Tara St', 'Tara'],
  PERSE: ['Pearse Station', 'Westland Row'],
  GCDK: ['Grand Canal', 'Barrow Street'],
  LDWNE: ['Lansdowne', 'Aviva'],
  DLERY: ['Dún Laoghaire', 'Dunleary', 'Dun Leary'],
  SHILL: ['Salthill', 'Monkstown'],
  SCOVE: ['Glasthule'],
  CTARF: ['Clontarf'],
  BFSTC: ['Belfast', 'Grand Central', 'Great Victoria Street'],
  HWTHJ: ['Donaghmede'],
};

function splitAlias(alias: string): string[] {
  return alias
    .split(/[()]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toStation(record: StationRecord): Station {
  const name = DISPLAY_NAMES[record.code] ?? record.name;
  const shortName = name.replace(/^Dublin\s+/i, '');
  const aliases = [
    shortName,
    ...splitAlias(record.apiAlias),
    ...officialAliases(record.code, shortName),
    ...(EXTRA_ALIASES[record.code] ?? []),
  ];
  const seen = new Set([name.toLowerCase()]);
  return {
    code: record.code,
    name,
    ...(name !== record.name && { apiName: record.name }),
    shortName,
    ...(OFFICIAL_NAMES[record.code] && { officialName: `${OFFICIAL_NAMES[record.code]} Station` }),
    branch: branchOf(record.code) ?? 'trunk',
    irishName: IRISH_NAMES[record.code]?.name,
    irishShortName: IRISH_NAMES[record.code]?.short ?? IRISH_NAMES[record.code]?.name,
    aliases: aliases.filter((a) => {
      const key = a.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    lat: record.lat,
    lon: record.lon,
  };
}

/**
 * DART stations in line order (see `LINE_ORDER`). The API's DART list also includes stations
 * no DART serves (e.g. Kilcoole, beyond Greystones), so only stations on the line are kept.
 */
export const DART_STATIONS: Station[] = LINE_ORDER.map((code) => {
  const record = DART_STATION_DATA.find((r) => r.code === code);
  if (!record) throw new Error(`Station ${code} is on the line but missing from stations.data.ts`);
  return toStation(record);
});

/** Enterprise stations, north (Belfast) to south (Connolly); Connolly is the same object as on the DART. */
export const ENTERPRISE_STATIONS: Station[] = [...ENTERPRISE_LINE.paths[0]!].reverse().map((code) => {
  const shared = DART_STATIONS.find((s) => s.code === code);
  if (shared) return shared;
  const record = ENTERPRISE_STATION_DATA.find((r) => r.code === code);
  if (!record) throw new Error(`Station ${code} is on the Enterprise but missing from stations.enterprise.data.ts`);
  return toStation(record);
});

/** Cork commuter stations in map order: Mallow (north) first, then Cork, then the Cobh and Midleton lines. */
export const CORK_STATIONS: Station[] = CORK_STATION_DATA.map(toStation);
// Every Cork station must be on the line (and vice versa), or the map and the line disagree.
for (const code of new Set(CORK_LINE.paths.flat())) {
  if (!CORK_STATIONS.some((s) => s.code === code)) throw new Error(`Station ${code} is on the Cork line but missing from stations.cork.data.ts`);
}

/** Commuter stations not already on the DART or Enterprise. `COMMUTER_STATIONS` (services.ts) adds the shared ones. */
export const COMMUTER_ONLY_STATIONS: Station[] = COMMUTER_STATION_DATA.map(toStation);

/** Intercity stations not on any other service. `INTERCITY_STATIONS` (services.ts) adds the shared ones. */
export const INTERCITY_ONLY_STATIONS: Station[] = INTERCITY_STATION_DATA.map(toStation);

/** Northern Ireland Railways stations not already above (Belfast, Portadown and Newry are Enterprise stations). */
export const NIR_ONLY_STATIONS: Station[] = NIR_STATION_DATA.map(toStation);

/** Every station the apps know about, across all services. Lookups by code or name use this. */
export const ALL_STATIONS: Station[] = [
  ...DART_STATIONS,
  ...ENTERPRISE_STATIONS.filter((s) => !DART_STATIONS.includes(s)),
  ...CORK_STATIONS,
  ...COMMUTER_ONLY_STATIONS,
  ...INTERCITY_ONLY_STATIONS,
  ...NIR_ONLY_STATIONS,
];

/** The official Irish name for any station code, including stations only on the all-stations map. */
export function irishNameFor(code: string): string | undefined {
  return IRISH_NAMES[code]?.name;
}

export function findStationByCode(code: string, stations: Station[] = ALL_STATIONS): Station | undefined {
  const wanted = code.trim().toUpperCase();
  return stations.find((s) => s.code === wanted);
}

/** Exact lookup by Irish Rail's full name, as used in departure origins and destinations. */
export function findStationByName(name: string, stations: Station[] = ALL_STATIONS): Station | undefined {
  const wanted = name.trim();
  return stations.find((s) => s.name === wanted || s.apiName === wanted);
}

export function normaliseStationName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^dublin /, '')
    .replace(/ (station|stn)$/, '')
    .replace(/\bst\b/g, 'street');
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length]!;
}

function scoreKey(query: string, key: string): number {
  if (key === query) return 100;
  if (query.length >= 3 && key.startsWith(query)) return 80;
  if (query.length >= 3 && key.includes(query)) return 60;
  const allowed = Math.max(1, Math.floor(key.length / 5));
  const distance = levenshtein(query, key);
  return distance <= allowed ? 50 - distance : 0;
}

function scoreStation(query: string, station: Station): number {
  if (station.code === query.trim().toUpperCase()) return 100;
  const q = normaliseStationName(query);
  if (!q) return 0;
  // Irish names are searchable too (fadas optional), but kept out of `aliases` so they don't become Alexa synonyms.
  const keys = [station.name, ...station.aliases, station.irishName, station.irishShortName].filter((k): k is string => !!k);
  return Math.max(...keys.map((k) => scoreKey(q, normaliseStationName(k))));
}

/** Stations matching a free-text query, best match first. An empty query returns every station. */
export function searchStations(query: string, stations: Station[] = DART_STATIONS): Station[] {
  if (!query.trim()) return stations;
  return stations
    .map((station, index) => ({ station, index, score: scoreStation(query, station) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.station);
}

/** Best station for a name, alias, code or near-miss spelling (e.g. "connoly"). */
export function resolveStation(query: string, stations: Station[] = DART_STATIONS): Station | undefined {
  return query.trim() ? searchStations(query, stations)[0] : undefined;
}
