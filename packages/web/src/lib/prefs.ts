import { useSyncExternalStore } from 'react';

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

/** Where favourite stations show: on each service's map page ("service") or together on the home page ("home"). */
export type FavouritesPlace = 'service' | 'home';

const FAVOURITES_PLACE_KEY = 'dart-times:favourites-place';
const placeListeners = new Set<() => void>();

function readFavouritesPlace(): FavouritesPlace {
  try {
    return localStorage.getItem(FAVOURITES_PLACE_KEY) === 'home' ? 'home' : 'service';
  } catch {
    return 'service';
  }
}

let favouritesPlace = readFavouritesPlace();

function setFavouritesPlace(place: FavouritesPlace): void {
  favouritesPlace = place;
  try {
    localStorage.setItem(FAVOURITES_PLACE_KEY, place);
  } catch {
    // Applied for this visit only.
  }
  placeListeners.forEach((listener) => listener());
}

/** The favourites placement and a setter, shared by every component that uses it (the options menu and the pages). */
export function useFavouritesPlace(): [FavouritesPlace, (place: FavouritesPlace) => void] {
  const place = useSyncExternalStore(
    (listener) => {
      placeListeners.add(listener);
      return () => placeListeners.delete(listener);
    },
    () => favouritesPlace,
  );
  return [place, setFavouritesPlace];
}
