import { useEffect, useState } from 'react';
import { irishDate, irishSecondsOfDay, type ScheduledDeparture } from '@dart-times/core';
import { fetchTimetable } from './api';

const REFRESH_MS = 30 * 60_000;
/** Until about 4am, trains from yesterday's service day may still be running (GTFS times past 24:00). */
const AFTER_MIDNIGHT_UNTIL_MINS = 4 * 60;

/**
 * A station's timetabled departures for today's service day (plus yesterday's still running after midnight),
 * from the static files the daily timetable job writes. Minutes are after today's midnight, Irish time.
 */
export function useScheduled(code: string, enabled = true) {
  const [departures, setDepartures] = useState<ScheduledDeparture[]>();
  useEffect(() => {
    let cancelled = false;
    setDepartures(undefined);
    if (!enabled) return;
    const load = async () => {
      if (document.hidden) return;
      const now = Date.now();
      const earlyMorning = irishSecondsOfDay(now) / 60 < AFTER_MIDNIGHT_UNTIL_MINS;
      // The timetable is extra: if a file is missing or fails, live departures still show and this stays empty.
      const [today, yesterday] = await Promise.all([
        fetchTimetable(irishDate(now), code).catch(() => undefined),
        earlyMorning ? fetchTimetable(irishDate(now, -1), code).catch(() => undefined) : undefined,
      ]);
      if (cancelled) return;
      const late = (yesterday?.departures ?? []).filter((d) => d.minutes >= 1440).map((d) => ({ ...d, minutes: d.minutes - 1440 }));
      setDepartures([...late, ...(today?.departures ?? [])].sort((a, b) => a.minutes - b.minutes));
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, enabled]);
  return departures;
}
