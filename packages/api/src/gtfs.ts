// Downloading and opening Irish Rail's GTFS timetable zip (published by the NTA; no key needed).
import { strFromU8, unzipSync } from 'fflate';
import type { GtfsFiles } from '@dart-times/core';

export const GTFS_URL = 'https://www.transportforireland.ie/transitData/Data/GTFS_Irish_Rail.zip';

const NEEDED: Record<keyof GtfsFiles, string> = {
  stops: 'stops.txt',
  routes: 'routes.txt',
  trips: 'trips.txt',
  stopTimes: 'stop_times.txt',
  calendar: 'calendar.txt',
  calendarDates: 'calendar_dates.txt',
};

export async function downloadGtfs(url = GTFS_URL, fetchImpl: typeof fetch = fetch): Promise<GtfsFiles> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GTFS download failed: HTTP ${res.status}`);
  return readGtfsZip(new Uint8Array(await res.arrayBuffer()));
}

/** The files we use from the zip (shapes.txt alone is ~28 MB, so only these are unpacked). */
export function readGtfsZip(zip: Uint8Array): GtfsFiles {
  const wanted = new Set(Object.values(NEEDED));
  const unzipped = unzipSync(zip, { filter: (f) => wanted.has(f.name) });
  const text = (name: string) => {
    const file = unzipped[name];
    if (!file) throw new Error(`GTFS zip has no ${name}`);
    return strFromU8(file);
  };
  return Object.fromEntries(Object.entries(NEEDED).map(([key, name]) => [key, text(name)])) as unknown as GtfsFiles;
}
