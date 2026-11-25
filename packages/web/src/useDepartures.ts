import { useEffect, useState } from 'react';
import type { ServiceId } from '@dart-times/core';
import { type DeparturesResponse, fetchDepartures } from './api';

const REFRESH_MS = 30_000;

/** Live departures for a station, refreshed every 30s while the tab is visible. */
export function useDepartures(code: string, service: ServiceId) {
  const [data, setData] = useState<DeparturesResponse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);

    const load = () => {
      if (document.hidden) return;
      fetchDepartures(code, service).then(
        (res) => !cancelled && (setData(res), setError(undefined)),
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
  }, [code, service]);

  return { data, error };
}
