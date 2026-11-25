const LAST_STATION_KEY = 'dart-times:last-station';
const LAST_SERVICE_KEY = 'dart-times:last-service';

/** The service (DART or Enterprise) the app reopens on. */
export function getLastService(): string | undefined {
  try {
    return localStorage.getItem(LAST_SERVICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setLastService(service: string): void {
  try {
    localStorage.setItem(LAST_SERVICE_KEY, service);
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}

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

const GOING_TO_KEY = 'dart-times:going-to';

function readGoingTo(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GOING_TO_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Where you usually go from a station, so your trip is set up next time. Keyed per service and station. */
export function getGoingTo(key: string): string | undefined {
  return readGoingTo()[key];
}

export function setGoingTo(key: string, destination: string | undefined): void {
  const all = readGoingTo();
  if (destination) all[key] = destination;
  else delete all[key];
  try {
    localStorage.setItem(GOING_TO_KEY, JSON.stringify(all));
  } catch {
    // Remembered for this visit only.
  }
}
