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

const GOING_TO_KEY = 'dart-times:going-to';

function readGoingTo(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GOING_TO_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Where you usually go from a station, so your trip is set up next time. */
export function getGoingTo(stationCode: string): string | undefined {
  return readGoingTo()[stationCode];
}

export function setGoingTo(stationCode: string, destination: string | undefined): void {
  const all = readGoingTo();
  if (destination) all[stationCode] = destination;
  else delete all[stationCode];
  try {
    localStorage.setItem(GOING_TO_KEY, JSON.stringify(all));
  } catch {
    // Remembered for this visit only.
  }
}
