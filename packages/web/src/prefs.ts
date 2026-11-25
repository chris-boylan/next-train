const LAST_STATION_KEY = 'dart-times:last-station';

/** The station the app reopens on. Storage can be blocked (private mode), so failures are ignored. */
export function getLastStation(): string | undefined {
  try {
    return localStorage.getItem(LAST_STATION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setLastStation(code: string): void {
  try {
    localStorage.setItem(LAST_STATION_KEY, code);
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
