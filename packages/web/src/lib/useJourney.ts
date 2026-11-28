import { useEffect, useState } from 'react';
import { type Departure, type Journey, luasJourney } from '@dart-times/core';
import { fetchJourney } from './api';

const REFRESH_MS = 30_000;

/**
 * A train's journey from a station, refreshed every 30s while the tab is visible. A Luas tram's is estimated here
 * instead (the feed can't follow a tram from stop to stop): from when it was due when opened, plus the timetable's
 * run times, worked out again each time so its minutes count down.
 */
export function useJourney(train: Departure, from: string) {
  const [journey, setJourney] = useState<Journey>();
  const [error, setError] = useState<string>();
  const tram = train.category === 'luas';
  const [dueAt] = useState(() => Date.now() + train.dueInMins * 60_000);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      if (tram) {
        const estimate = luasJourney(train, from, dueAt, Date.now());
        if (estimate) setJourney(estimate);
        else setError('No estimate');
        return;
      }
      fetchJourney(train.trainCode, from).then(
        (res) => !cancelled && (setJourney(res), setError(undefined)),
        (err: Error) => !cancelled && setError(err.message),
      );
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
    // The train's code names it (a tram's is made from its direction, destination and due time), so a refreshed
    // copy of the same train doesn't start it again.
  }, [train.trainCode, from, tram, dueAt]);

  return { journey, error };
}
