import { useSyncExternalStore } from 'react';
import type { CountdownStyle } from './due';

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

/**
 * A choice kept in localStorage and shared live by every component that uses it (the options menu and the pages).
 * Anything unrecognised in storage reads as `fallback`.
 */
function storedChoice<T extends string>(key: string, values: readonly T[], fallback: T): () => [T, (value: T) => void] {
  const listeners = new Set<() => void>();
  let current = fallback;
  try {
    const stored = localStorage.getItem(key);
    if (values.includes(stored as T)) current = stored as T;
  } catch {
    // No storage: use the default.
  }

  const set = (value: T) => {
    current = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Applied for this visit only.
    }
    listeners.forEach((listener) => listener());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return () => [useSyncExternalStore(subscribe, () => current), set];
}

/** Where favourite stations show: on each service's map page ("service") or together on the home page ("home"). */
export type FavouritesPlace = 'service' | 'home';

export const useFavouritesPlace = storedChoice<FavouritesPlace>('dart-times:favourites-place', ['service', 'home'], 'service');

/** Countdowns of an hour or more: "86 min" (the default) or "1h 26min". */
export const useCountdownStyle = storedChoice<CountdownStyle>('dart-times:countdown-style', ['minutes', 'hours'], 'minutes');

/** A station shown on its two tracks (the default) or as a list board; switched by the button by its name. */
export type StationView = 'tracks' | 'board';

export const useStationView = storedChoice<StationView>('dart-times:station-view', ['tracks', 'board'], 'tracks');

/**
 * Irish Rail's timetabled trains (beyond the live window, and timetable-only stretches): shown (the default) or
 * hidden. NI Railways always shows its timetable, since it has no live data at all.
 */
export type TimetabledTrains = 'on' | 'off';

export const useTimetabledTrains = storedChoice<TimetabledTrains>('dart-times:timetabled-trains', ['on', 'off'], 'on');

/** Whether the line maps show live trains: off until the viewer turns them on, then remembered per device. */
const useLiveTrainsChoice = storedChoice<'on' | 'off'>('dart-times:live-trains', ['on', 'off'], 'off');

export function useLiveTrainsPref(): [boolean, (on: boolean) => void] {
  const [choice, setChoice] = useLiveTrainsChoice();
  return [choice === 'on', (on) => setChoice(on ? 'on' : 'off')];
}

/** How the station page draws DART, InterCity and Enterprise trains: in their full livery (the default), or plain
 *  white, told apart by shape. */
export type TrainIcons = 'colour' | 'white';

export const useTrainIcons = storedChoice<TrainIcons>('dart-times:train-icons', ['colour', 'white'], 'colour');

/** The home page: trains (the service list, the default) or trams (the Luas map), switched by swiping across it
 *  or by the indicator beside the title, and remembered. */
export type HomeMode = 'train' | 'tram';

export const useHomeMode = storedChoice<HomeMode>('dart-times:home-mode', ['train', 'tram'], 'train');
