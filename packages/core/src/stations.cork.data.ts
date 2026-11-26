// Cork commuter stations, from the Irish Rail API station list (getAllStationsXML, Nov 2026).
// The API runs "LittleIsland" together; it's shown as "Little Island", with the API form kept as an alias.
import type { StationRecord } from './stations';

export const CORK_STATION_DATA: StationRecord[] = [
  { code: 'MLLOW', name: 'Mallow', apiAlias: '', lat: 52.1396, lon: -8.65521 },
  { code: 'CORK', name: 'Cork', apiAlias: 'Kent', lat: 51.9018, lon: -8.4582 },
  { code: 'LSLND', name: 'Little Island', apiAlias: 'LittleIsland', lat: 51.9078, lon: -8.35466 },
  { code: 'GHANE', name: 'Glounthaune', apiAlias: '', lat: 51.9112, lon: -8.3254 },
  { code: 'FOTA', name: 'Fota', apiAlias: '', lat: 51.896, lon: -8.3183 },
  { code: 'CGLOE', name: 'Carrigaloe', apiAlias: '', lat: 51.8688, lon: -8.32417 },
  { code: 'RBROK', name: 'Rushbrooke', apiAlias: '', lat: 51.8496, lon: -8.32252 },
  { code: 'COBH', name: 'Cobh', apiAlias: '', lat: 51.8491, lon: -8.29956 },
  { code: 'CGTWL', name: 'Carrigtwohill', apiAlias: '', lat: 51.9163, lon: -8.26323 },
  { code: 'MDLTN', name: 'Midleton', apiAlias: '', lat: 51.9212, lon: -8.17579 },
];
