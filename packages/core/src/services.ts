import type { RawStationData } from './irishRailClient';
import { COMMUTER_ROUTES, COMMUTER_STATION_CODES } from './commuter';
import { CORK_LINE, DART_LINE, ENTERPRISE_LINE, type Line } from './line';
import { ALL_STATIONS, CORK_STATIONS, DART_STATIONS, ENTERPRISE_STATIONS } from './stations';
import type { Station } from './types';

export type ServiceId = 'dart' | 'enterprise' | 'cork' | 'commuter';

export interface Service {
  id: ServiceId;
  line: Line;
  /** In map order, north to south. */
  stations: Station[];
  /** Whether a train on a station's departure board belongs to this service. */
  matches: (raw: RawStationData) => boolean;
}

const CORK_TERMINI = new Set(['Cork', 'Cobh', 'Midleton', 'Mallow']);

/** Every Dublin commuter station, shared ones (Connolly, the DART stretch) included, in route order. */
export const COMMUTER_STATIONS: Station[] = COMMUTER_STATION_CODES.map((code) => {
  const station = ALL_STATIONS.find((s) => s.code === code);
  if (!station) throw new Error(`Commuter station ${code} has no station record`);
  return station;
});

const isEnterprise = (raw: RawStationData) => raw.Origin.startsWith('Belfast') || raw.Destination.startsWith('Belfast');
const isCork = (raw: RawStationData) =>
  raw.Traintype !== 'DART' &&
  !raw.Traincode.trim().startsWith('A') &&
  [raw.Origin, raw.Destination].some((place) => CORK_TERMINI.has(place));

export const SERVICES: Record<ServiceId, Service> = {
  dart: {
    id: 'dart',
    line: DART_LINE,
    stations: DART_STATIONS,
    matches: (raw) => raw.Traintype === 'DART',
  },
  enterprise: {
    id: 'enterprise',
    line: ENTERPRISE_LINE,
    stations: ENTERPRISE_STATIONS,
    // The API has no Enterprise train type; it's the only Irish Rail service that runs to or from Belfast.
    matches: isEnterprise,
  },
  cork: {
    id: 'cork',
    line: CORK_LINE,
    stations: CORK_STATIONS,
    // Commuter trains (not DART, not InterCity "A" codes) starting or ending at a Cork commuter terminus.
    matches: isCork,
  },
  commuter: {
    id: 'commuter',
    // Stations show departure boards grouped by route (commuterHeading), so the line is just every route's paths.
    line: { paths: COMMUTER_ROUTES.flatMap((r) => r.line.paths), termini: { Northbound: [], Southbound: [] } },
    stations: COMMUTER_STATIONS,
    // Dublin commuter trains: not DART, not InterCity "A" codes, not Enterprise, not Cork.
    matches: (raw) =>
      raw.Traintype !== 'DART' && !raw.Traincode.trim().startsWith('A') && !isEnterprise(raw) && !isCork(raw),
  },
};

export function isServiceId(value: unknown): value is ServiceId {
  return value === 'dart' || value === 'enterprise' || value === 'cork' || value === 'commuter';
}
