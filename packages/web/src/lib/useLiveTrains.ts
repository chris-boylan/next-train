import { useEffect, useState } from 'react';
import type { LiveTrain, ServiceId } from '@dart-times/core';
import { fetchLiveTrains } from './api';

const REFRESH_MS = 30_000;

/**
 * Live train positions for a service's map, refreshed every 30 s while the tab is visible.
 * Does nothing while `enabled` is false, so the map costs no requests until the viewer turns it on.
 */
export function useLiveTrains(service: ServiceId, enabled: boolean) {
  const [trains, setTrains] = useState<LiveTrain[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setTrains(undefined);
    setError(undefined);
    if (!enabled) return;
    let cancelled = false;

    const load = () => {
      if (document.hidden) return;
      fetchLiveTrains(service).then(
        (res) => !cancelled && (setTrains(res.trains), setError(undefined)),
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
  }, [service, enabled]);

  return { trains, error, loading: enabled && !trains && !error };
}
