import { useEffect, useState } from 'react';
import { irishDate, irishSecondsOfDay, type ScheduledDeparture } from '@dart-times/core';
import { fetchTimetable } from './api';

const REFRESH_MS = 30 * 60_000;
/** Until about 4am, trains from yesterday's service day may still be running (GTFS times past 24:00). */
const AFTER_MIDNIGHT_UNTIL_MINS = 4 * 60;

/** A timetabled departure; `tomorrow` when it's from tomorrow's timetable (its minutes are then past 1440). */
export type TimetabledDeparture = ScheduledDeparture & { tomorrow?: boolean };

/**
 * A station's timetabled departures for today's service day (plus yesterday's still running after midnight),
 * from the static files the daily timetable job writes. Minutes are after today's midnight, Irish time. With
 * `withTomorrow`, tomorrow's trains follow (minutes + 1440), so a page after the last train can show the first.
 */
export function useScheduled(code: string, enabled = true, withTomorrow = false) {
  const [departures, setDepartures] = useState<TimetabledDeparture[]>();
  useEffect(() => {
    let cancelled = false;
    setDepartures(undefined);
    if (!enabled) return;
    const load = async () => {
      if (document.hidden) return;
      const now = Date.now();
      const earlyMorning = irishSecondsOfDay(now) / 60 < AFTER_MIDNIGHT_UNTIL_MINS;
      // The timetable is extra: if a file is missing or fails, live departures still show and this stays empty.
      const [today, yesterday, next] = await Promise.all([
        fetchTimetable(irishDate(now), code).catch(() => undefined),
        earlyMorning ? fetchTimetable(irishDate(now, -1), code).catch(() => undefined) : undefined,
        withTomorrow ? fetchTimetable(irishDate(now, 1), code).catch(() => undefined) : undefined,
      ]);
      if (cancelled) return;
      const late = (yesterday?.departures ?? []).filter((d) => d.minutes >= 1440).map((d) => ({ ...d, minutes: d.minutes - 1440 }));
      // Tomorrow's trains before its midnight; its after-midnight ones are the day after.
      const tomorrow = (next?.departures ?? []).filter((d) => d.minutes < 1440).map((d) => ({ ...d, minutes: d.minutes + 1440, tomorrow: true }));
      setDepartures([...late, ...(today?.departures ?? []), ...tomorrow].sort((a, b) => a.minutes - b.minutes));
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, enabled, withTomorrow]);
  return departures;
}
