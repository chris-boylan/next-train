import type { Departure, Direction } from './types';

/** Delays at or above this many minutes are worth calling out. */
export const SIGNIFICANT_DELAY_MINS = 10;

function minutes(n: number): string {
  return `${n} minute${n === 1 ? '' : 's'}`;
}

export function dueText(dueInMins: number): string {
  return dueInMins <= 0 ? 'due now' : `in ${minutes(dueInMins)}`;
}

export function delayText(lateMins: number): string {
  return lateMins <= 0 ? 'on time' : `${minutes(lateMins)} late`;
}

export type DelaySeverity = 'on-time' | 'minor' | 'major';

export function delaySeverity(lateMins: number): DelaySeverity {
  if (lateMins <= 0) return 'on-time';
  return lateMins >= SIGNIFICANT_DELAY_MINS ? 'major' : 'minor';
}

export function isSignificantDelay(departure: Departure): boolean {
  return delaySeverity(departure.lateMins) === 'major';
}

export function directionLabel(direction: Direction | string): string {
  return direction.toLowerCase();
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** One-line description shared by the web UI's accessible labels and Alexa's speech. */
export function describeDeparture(departure: Departure): string {
  const delay = departure.lateMins > 0 ? `, running ${delayText(departure.lateMins)}` : '';
  return `to ${departure.destination} ${dueText(departure.dueInMins)}${delay}`;
}
