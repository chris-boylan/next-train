// Irish Rail's GTFS timetable, downloaded and kept in memory: one download per Lambda container, refreshed every
// few hours, with each service day built on first use. No storage or scheduled job needed.
import { unzipSync, strFromU8 } from 'fflate';
import { ALL_STATIONS, buildTimetable, type GtfsFiles, irishSecondsOfDay, type ScheduledDeparture, scheduledBetween, type Timetable } from '@dart-times/core';

export const GTFS_URL = 'https://www.transportforireland.ie/transitData/Data/GTFS_Irish_Rail.zip';
const REFRESH_MS = 6 * 60 * 60_000;

export interface ScheduledSource {
  /** Scheduled departures at a station from now until `hours` from now. */
  scheduled(code: string, nowMs: number, hours: number): Promise<ScheduledDeparture[]>;
}

/** `YYYYMMDD` in Irish time, `daysAgo` days before `nowMs`. */
export function irishDate(nowMs: number, daysAgo = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(nowMs - daysAgo * 86_400_000));
  return parts.replace(/-/g, '');
}

export class GtfsTimetable implements ScheduledSource {
  private files?: Promise<GtfsFiles>;
  private loadedAt = 0;
  private readonly days = new Map<string, Timetable>();

  constructor(
    private readonly url = GTFS_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private loadFiles(nowMs: number): Promise<GtfsFiles> {
    if (!this.files || nowMs - this.loadedAt > REFRESH_MS) {
      this.loadedAt = nowMs;
      this.days.clear();
      this.files = this.download().catch((err: unknown) => {
        this.files = undefined; // try again next time
        throw err;
      });
    }
    return this.files;
  }

  private async download(): Promise<GtfsFiles> {
    const res = await this.fetchImpl(this.url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`GTFS download failed (${res.status})`);
    const zip = unzipSync(new Uint8Array(await res.arrayBuffer()), {
      // Only the files we read (shapes.txt alone is ~28 MB).
      filter: (f) => ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt'].includes(f.name),
    });
    const text = (name: string) => {
      const file = zip[name];
      if (!file) throw new Error(`GTFS zip has no ${name}`);
      return strFromU8(file);
    };
    return {
      stops: text('stops.txt'),
      routes: text('routes.txt'),
      trips: text('trips.txt'),
      stopTimes: text('stop_times.txt'),
      calendar: text('calendar.txt'),
      calendarDates: text('calendar_dates.txt'),
    };
  }

  private async day(date: string, nowMs: number): Promise<Timetable> {
    const files = await this.loadFiles(nowMs);
    let day = this.days.get(date);
    if (!day) {
      day = buildTimetable(files, date, ALL_STATIONS);
      this.days.set(date, day);
    }
    return day;
  }

  async scheduled(code: string, nowMs: number, hours: number): Promise<ScheduledDeparture[]> {
    const [today, yesterday] = await Promise.all([this.day(irishDate(nowMs), nowMs), this.day(irishDate(nowMs, 1), nowMs)]);
    const now = Math.floor(irishSecondsOfDay(nowMs) / 60);
    return scheduledBetween(code, today, yesterday, now, now + hours * 60);
  }
}
