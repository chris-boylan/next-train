import type { Departure, Direction, Station } from '@dart-times/core';

export interface DeparturesResponse {
  station: Station;
  direction: Direction | null;
  departures: Departure[];
  fetchedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

/** All DART departures in the next 90 minutes, both directions. */
export function fetchDepartures(code: string) {
  return request<DeparturesResponse>(`/stations/${code}/departures`);
}

export function fetchFavourites(deviceId: string) {
  return request<Station[]>('/favourites', { headers: { 'x-device-id': deviceId } });
}

export function setFavourite(deviceId: string, code: string, favourite: boolean) {
  return request<Station[]>(`/favourites/${code}`, {
    method: favourite ? 'PUT' : 'DELETE',
    headers: { 'x-device-id': deviceId },
  });
}
