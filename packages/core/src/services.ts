import type { RawStationData } from './irishRailClient';
import { CORK_LINE, DART_LINE, ENTERPRISE_LINE, type Line } from './line';
import { CORK_STATIONS, DART_STATIONS, ENTERPRISE_STATIONS } from './stations';
import type { Station } from './types';

export type ServiceId = 'dart' | 'enterprise' | 'cork';

export interface Service {
  id: ServiceId;
  line: Line;
  /** In map order, north to south. */
  stations: Station[];
  /** Whether a train on a station's departure board belongs to this service. */
  matches: (raw: RawStationData) => boolean;
}

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
    matches: (raw) => raw.Origin.startsWith('Belfast') || raw.Destination.startsWith('Belfast'),
  },
  cork: {
    id: 'cork',
    line: CORK_LINE,
    stations: CORK_STATIONS,
    // Commuter trains (not DART, not InterCity "A" codes) starting or ending at a Cork commuter terminus.
    matches: (raw) =>
      raw.Traintype !== 'DART' &&
      !raw.Traincode.trim().startsWith('A') &&
      [raw.Origin, raw.Destination].some((place) => CORK_TERMINI.has(place)),
  },
};

const CORK_TERMINI = new Set(['Cork', 'Cobh', 'Midleton', 'Mallow']);

export function isServiceId(value: unknown): value is ServiceId {
  return value === 'dart' || value === 'enterprise' || value === 'cork';
}
