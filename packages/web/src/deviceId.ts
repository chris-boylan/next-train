const KEY = 'dart-times:device-id';

/** Anonymous per-browser ID used to key favourites. Falls back to a per-session ID if storage is blocked. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
