import type { RawStationData } from './irishRailClient';
import { DART_LINE, ENTERPRISE_LINE, type Line } from './line';
import { DART_STATIONS, ENTERPRISE_STATIONS } from './stations';
import type { Station } from './types';

export type ServiceId = 'dart' | 'enterprise';

export interface Service {
  id: ServiceId;
  line: Line;
  /** In map order, north to south. */
  stations: Station[];
  /** Whether a train on a station's departure board belongs to this service. */
  matches: (raw: RawStationData) => boolean;
  /** Where the line crosses the Irish border, as [north, south] neighbouring stations. */
  border?: [string, string];
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
    border: ['NEWRY', 'DDALK'],
  },
};

export function isServiceId(value: unknown): value is ServiceId {
  return value === 'dart' || value === 'enterprise';
}
