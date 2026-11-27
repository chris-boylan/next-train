import { useEffect, useState } from 'react';
import type { ScheduledDeparture } from '@dart-times/core';
import { fetchScheduled } from './api';

const REFRESH_MS = 5 * 60_000;

/** A station's timetabled departures for the next few hours; refreshed every 5 minutes while visible. */
export function useScheduled(code: string, enabled = true) {
  const [departures, setDepartures] = useState<ScheduledDeparture[]>();
  useEffect(() => {
    let cancelled = false;
    setDepartures(undefined);
    if (!enabled) return;
    const load = () => {
      if (document.hidden) return;
      // The timetable is extra: if it fails, the live departures still show and this stays empty.
      fetchScheduled(code).then(
        (res) => !cancelled && setDepartures(res.departures),
        () => {},
      );
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code, enabled]);
  return departures;
}
