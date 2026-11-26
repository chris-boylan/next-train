import type { RawStationData } from './irishRailClient';
import { COMMUTER_ROUTES, COMMUTER_STATION_CODES } from './commuter';
import { INTERCITY_ROUTES, INTERCITY_STATION_CODES } from './intercity';
import { CORK_LINE, DART_LINE, ENTERPRISE_LINE, type Line } from './line';
import { ALL_STATIONS, CORK_STATIONS, DART_STATIONS, ENTERPRISE_STATIONS } from './stations';
import type { Station } from './types';

export type ServiceId = 'dart' | 'enterprise' | 'cork' | 'commuter' | 'intercity';

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
export const COMMUTER_STATIONS: Station[] = stationsFor(COMMUTER_STATION_CODES, 'Commuter');

/** Every Intercity station, shared ones (Heuston, Kildare, Mallow, Cork…) included, in route order. */
export const INTERCITY_STATIONS: Station[] = stationsFor(INTERCITY_STATION_CODES, 'Intercity');

function stationsFor(codes: string[], service: string): Station[] {
  return codes.map((code) => {
    const station = ALL_STATIONS.find((s) => s.code === code);
    if (!station) throw new Error(`${service} station ${code} has no station record`);
    return station;
  });
}

/** InterCity trains have "A" train codes; the Enterprise does too, so callers check for it separately. */
const isIntercityCode = (raw: RawStationData) => raw.Traincode.trim().startsWith('A');
const isEnterprise = (raw: RawStationData) => raw.Origin.startsWith('Belfast') || raw.Destination.startsWith('Belfast');
const isCork = (raw: RawStationData) =>
  raw.Traintype !== 'DART' &&
  !isIntercityCode(raw) &&
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
      raw.Traintype !== 'DART' && !isIntercityCode(raw) && !isEnterprise(raw) && !isCork(raw),
  },
  intercity: {
    id: 'intercity',
    // Stations show departure boards grouped by route (intercityHeading), as for Dublin Commuter.
    line: { paths: INTERCITY_ROUTES.flatMap((r) => r.line.paths), termini: { Northbound: [], Southbound: [] } },
    stations: INTERCITY_STATIONS,
    // Every InterCity train has an "A" code, local runs (Ennis–Limerick Junction, Tralee–Mallow) included.
    matches: (raw) => raw.Traintype !== 'DART' && isIntercityCode(raw) && !isEnterprise(raw),
  },
};

export function isServiceId(value: unknown): value is ServiceId {
  return value === 'dart' || value === 'enterprise' || value === 'cork' || value === 'commuter' || value === 'intercity';
}
