// Enterprise stations beyond Connolly, from the Irish Rail API station list (getAllStationsXML, Nov 2026).
import type { StationRecord } from './stations';

export const ENTERPRISE_STATION_DATA: StationRecord[] = [
  { code: 'DGHDA', name: 'Drogheda', apiAlias: '', lat: 53.712, lon: -6.33538 },
  { code: 'DDALK', name: 'Dundalk', apiAlias: '', lat: 54.0007, lon: -6.41291 },
  { code: 'NEWRY', name: 'Newry', apiAlias: '', lat: 54.1911, lon: -6.36225 },
  { code: 'PDOWN', name: 'Portadown', apiAlias: '', lat: 54.4295, lon: -6.43868 },
  // Belfast Grand Central's position (the API's coordinates are the old station's, 2.4 km away).
  { code: 'BFSTC', name: 'Belfast', apiAlias: '', lat: 54.59515, lon: -5.93973 },
];
