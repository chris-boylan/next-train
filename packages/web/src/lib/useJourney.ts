import { useEffect, useState } from 'react';
import type { Journey } from '@dart-times/core';
import { fetchJourney } from './api';

const REFRESH_MS = 30_000;

/** A train's journey from a station, refreshed every 30s while the tab is visible. */
export function useJourney(trainCode: string, from: string) {
  const [journey, setJourney] = useState<Journey>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      fetchJourney(trainCode, from).then(
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
  }, [trainCode, from]);

  return { journey, error };
}
