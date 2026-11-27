/** Dublin commuter routes as drawn on the map: core's route lines plus a colour each. */
import { COMMUTER_ROUTES, type CommuterRouteId } from '@dart-times/core';
import { buildRouteMap } from './routeMaps';

// Distinct colours so the routes can be told apart on the combined map. Irish Rail publishes none of its own for
// these routes; South Western orange and South Eastern raspberry replaced a dull mustard and brown (Nov 2026).
export const COMMUTER_ROUTE_MAP = buildRouteMap<CommuterRouteId>(
  COMMUTER_ROUTES,
  {
    northern: '#00897b',
    western: '#3f51b5',
    southWestern: '#e07b00',
    southEastern: '#c2185b',
  },
  // South Eastern is the middle stripe from Connolly to Grand Canal Dock, so it runs on straight down its own line
  // there; Northern stays east and South Western west (it leaves Connolly that way, below Western, at Drumcondra).
  ['northern', 'western', 'southEastern', 'southWestern'],
);

/** Drawn as a circle on the all-routes map: Northern, Western and South Western trains end at Grand Canal Dock. */
export const COMMUTER_MAP_TERMINI: ReadonlySet<string> = new Set(['GCDK']);
