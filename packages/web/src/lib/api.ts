import type { Departure, Direction, Journey, LiveTrain, ServiceId, Station, StationTimetableFile } from '@dart-times/core';
import { timetablePath } from '@dart-times/core';

export interface DeparturesResponse {
  station: Station;
  direction: Direction | null;
  departures: Departure[];
  /** Luas stops only: the line's status, and tracks where no tram stops here (see core's LuasDepartures). */
  luas?: { message: string; disrupted: boolean; noService: Direction[] };
  fetchedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

/** All of a service's departures in the next 90 minutes, both directions. */
export function fetchDepartures(code: string, service: ServiceId | 'all') {
  return request<DeparturesResponse>(`/stations/${code}/departures?service=${service}`);
}

export interface LiveTrainsResponse {
  service: ServiceId;
  trains: LiveTrain[];
  fetchedAt: string;
}

/** Where every running train on a service is right now (DART only so far). */
export function fetchLiveTrains(service: ServiceId) {
  return request<LiveTrainsResponse>(`/trains?service=${service}`);
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

export interface FeedbackPayload {
  message: string;
  email?: string;
  /** Hidden honeypot field; people leave it empty. */
  website: string;
  elapsedMs: number;
  lang: string;
  appVersion: string;
}

export class FeedbackError extends Error {
  constructor(
    message: string,
    readonly tooMany: boolean,
  ) {
    super(message);
  }
}

/** Sends a help-page message. CloudFront signs requests to the API, which needs the body's SHA-256 for POSTs. */
export async function sendFeedback(deviceId: string, payload: FeedbackPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-id': deviceId, 'x-amz-content-sha256': await sha256Hex(body) },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new FeedbackError(data?.error ?? `Request failed (${res.status})`, res.status === 429);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** One train's stops from a station to its terminus, and where it is now. */
export function fetchJourney(trainCode: string, from: string) {
  return request<Journey>(`/trains/${encodeURIComponent(trainCode.trim())}/journey?from=${from}`);
}

/**
 * A station's timetable for one service day: a static file the daily timetable job writes and CloudFront serves
 * (`/timetable/<date>/<code>.json`), not an API call. Undefined when there's no file (no trains, or not built).
 */
export async function fetchTimetable(date: string, code: string): Promise<StationTimetableFile | undefined> {
  const res = await fetch(`/${timetablePath(date, code)}`);
  if (!res.ok) return undefined;
  return (await res.json().catch(() => undefined)) as StationTimetableFile | undefined;
}
