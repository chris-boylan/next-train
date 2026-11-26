/** Dublin commuter routes as drawn on the map: core's route lines plus a colour each. */
import { COMMUTER_ROUTES, type CommuterRouteId } from '@dart-times/core';
import { buildRouteMap } from './routeMaps';

// Distinct colours so the routes can be told apart on the combined map.
export const COMMUTER_ROUTE_MAP = buildRouteMap<CommuterRouteId>(COMMUTER_ROUTES, {
  northern: '#00897b',
  western: '#3f51b5',
  southWestern: '#c27c0e',
  southEastern: '#8d6e63',
});
