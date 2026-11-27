/** Translink NI Railways routes as drawn on the map: core's route lines plus a colour each, as on NIR maps. */
import { NIR_ROUTES, type NirRouteId } from '@dart-times/core';
import { buildRouteMap } from './routeMaps';

export const NIR_ROUTE_MAP = buildRouteMap<NirRouteId>(NIR_ROUTES, {
  derry: '#1c9ad6',
  portrush: '#3a4ba0',
  larne: '#c4143c',
  bangor: '#f2a900',
  portadown: '#3aae49',
});
