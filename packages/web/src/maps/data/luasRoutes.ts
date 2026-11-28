/** Luas lines as drawn on the map: core's two lines, in the Luas's own red and green. */
import { LUAS_ROUTES, type LuasRouteId } from '@dart-times/core';
import { buildRouteMap } from './routeMaps';

export const LUAS_ROUTE_MAP = buildRouteMap<LuasRouteId>(LUAS_ROUTES, {
  red: '#c8102e',
  green: '#00843d',
});
