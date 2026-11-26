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
