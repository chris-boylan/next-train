/** Intercity routes as drawn on the map: core's route lines plus a colour each. */
import { INTERCITY_ROUTES, type IntercityRouteId } from '@dart-times/core';
import { buildRouteMap } from './routeMaps';

// Distinct hues of similar weight, readable on light and dark backgrounds.
export const INTERCITY_ROUTE_MAP = buildRouteMap<IntercityRouteId>(
  INTERCITY_ROUTES,
  {
    corkKerry: '#c62828',
    galwayMayo: '#7b1fa2',
    limerick: '#0277bd',
    waterford: '#2e7d32',
    sligo: '#ef6c00',
    rosslare: '#00838f',
  },
  // Stripes out of Heuston in the order the routes branch off: Waterford leaves first, east at Kildare, and Galway
  // & Mayo last, west at Portarlington, so it runs along the outside edge the whole way and flows off to Galway.
  ['waterford', 'corkKerry', 'limerick', 'galwayMayo', 'sligo', 'rosslare'],
);
