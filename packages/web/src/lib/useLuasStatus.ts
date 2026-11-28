import { useEffect, useState } from 'react';
import type { LuasLineStatus, LuasRouteId } from '@dart-times/core';
import { fetchLuasStatus } from './api';

/** The feed's status messages change rarely; once a minute is plenty. */
const REFRESH_MS = 60_000;

type Lines = Partial<Record<LuasRouteId, LuasLineStatus>>;
/** The last answer, so coming back to the map shows the news straight away while it checks again. */
let last: Lines = {};

/**
 * Both Luas lines' status, for the map's news ticker, refreshed every minute while the tab is visible. The last
 * answer until it loads (empty the first time), and left as it was if a refresh fails (a failed check isn't news).
 */
export function useLuasStatus(): Lines {
  const [lines, setLines] = useState<Lines>(last);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.hidden) return;
      fetchLuasStatus().then(
        (res) => {
          last = res.lines;
          if (!cancelled) setLines(res.lines);
        },
        (err: Error) => console.error(err),
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
  }, []);

  return lines;
}
