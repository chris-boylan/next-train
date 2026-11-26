import { describe, expect, it } from 'vitest';
import {
  ALL_STATIONS,
  type Departure,
  findStationByCode,
  INTERCITY_ROUTES,
  INTERCITY_STATIONS,
  intercityHeading,
  type RawStationData,
  SERVICES,
  toDepartures,
} from '../src';
import { fixtureClient } from './fixtures';

const train = (origin: string, destination: string): Departure => ({
  trainCode: 'A1', origin, destination, originCode: code(origin), destinationCode: code(destination), direction: '',
  dueInMins: 5, expectedDepart: '10:00', scheduledDepart: '10:00', lateMins: 0, trainType: 'Train', category: 'intercity',
  lastLocation: '',
});
function code(name: string): string | undefined {
  return ALL_STATIONS.find((s) => s.name === name)?.code;
}

describe('Intercity routes', () => {
  it('covers every station once, each with a station record', () => {
    const codes = INTERCITY_STATIONS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of new Set(INTERCITY_ROUTES.flatMap((r) => r.line.paths.flat()))) expect(findStationByCode(c)).toBeDefined();
  });

  it('includes the stations Intercity trains share with other services', () => {
    for (const c of ['HSTON', 'CNLLY', 'KDARE', 'PTLSE', 'MYNTH', 'GOREY', 'MLLOW', 'CORK']) {
      expect(INTERCITY_STATIONS.map((s) => s.code)).toContain(c);
    }
  });
});

describe('intercityHeading', () => {
  it('places trains on the route serving both stations, with the direction away from the hub', () => {
    expect(intercityHeading('HSTON', train('Dublin Heuston', 'Cork'))).toMatchObject({ route: { id: 'corkKerry' }, outbound: true });
    expect(intercityHeading('ATLNE', train('Westport', 'Dublin Heuston'))).toMatchObject({ route: { id: 'galwayMayo' }, outbound: false });
    expect(intercityHeading('MLGAR', train('Sligo', 'Dublin Connolly'))).toMatchObject({ route: { id: 'sligo' }, outbound: false });
    expect(intercityHeading('GOREY', train('Dublin Connolly', 'Rosslare Europort'))).toMatchObject({ route: { id: 'rosslare' }, outbound: true });
    expect(intercityHeading('CLMEL', train('Limerick Junction', 'Waterford'))).toMatchObject({ route: { id: 'waterford' }, outbound: true });
  });

  it('uses the origin to tell apart routes that share track', () => {
    // Thurles is on both the Cork and Limerick routes; where the train started decides which.
    expect(intercityHeading('THRLS', train('Limerick', 'Dublin Heuston'))).toMatchObject({ route: { id: 'limerick' } });
    expect(intercityHeading('THRLS', train('Cork', 'Dublin Heuston'))).toMatchObject({ route: { id: 'corkKerry' } });
    expect(intercityHeading('PTRTN', train('Westport', 'Dublin Heuston'))).toMatchObject({ route: { id: 'galwayMayo' } });
    expect(intercityHeading('KDARE', train('Waterford', 'Dublin Heuston'))).toMatchObject({ route: { id: 'waterford' } });
  });

  it('handles the cross-country lines', () => {
    expect(intercityHeading('ATHRY', train('Galway', 'Limerick'))).toMatchObject({ route: { id: 'limerick' }, outbound: false });
    expect(intercityHeading('LMRKJ', train('Limerick Junction', 'Ennis'))).toMatchObject({ route: { id: 'limerick' }, outbound: true });
    expect(intercityHeading('NNAGH', train('Ballybrophy', 'Limerick'))).toMatchObject({ route: { id: 'limerick' }, outbound: true });
    expect(intercityHeading('MLLOW', train('Cork', 'Tralee'))).toMatchObject({ route: { id: 'corkKerry' }, outbound: true });
  });

  it('gives up when no route serves both stations', () => {
    expect(intercityHeading('SLIGO', train('Sligo', 'Belfast'))).toBeUndefined();
  });
});

describe('Intercity service', () => {
  const raw = (code: string, origin: string, destination: string, type = 'Train'): RawStationData =>
    ({
      Traincode: code, Stationfullname: 'Dublin Connolly', Stationcode: 'CNLLY', Origin: origin, Destination: destination,
      Status: '', Lastlocation: '', Duein: '5', Late: '0', Exparrival: '', Expdepart: '10:00', Scharrival: '',
      Schdepart: '10:00', Direction: '', Traintype: type, Locationtype: 'S',
    }) as RawStationData;

  it('keeps InterCity trains and leaves out DART, commuter, Enterprise and Cork commuter', () => {
    const board = [
      raw('A602', 'Dublin Connolly', 'Rosslare Europort'),
      raw('A905', 'Sligo', 'Dublin Connolly'),
      raw('P700', 'Dublin Connolly', 'Maynooth'),
      raw('E101', 'Bray', 'Howth', 'DART'),
      raw('A124', 'Dublin Connolly', 'Belfast'),
      raw('P501', 'Cobh', 'Cork'),
    ];
    expect(board.filter(SERVICES.intercity.matches).map((r) => r.Traincode)).toEqual(['A602', 'A905']);
  });

  it('splits a real Heuston board between Intercity and Dublin Commuter', async () => {
    const board = await fixtureClient('heuston-midday.xml').getStationData('HSTON');
    const codes = (service: 'intercity' | 'commuter') =>
      board.filter(SERVICES[service].matches).map((r) => r.Traincode.trim()).sort();
    expect(codes('intercity')).toEqual(['A209', 'A210', 'A212', 'A303', 'A407', 'A509', 'A709', 'A710']);
    expect(codes('commuter')).toEqual(['D208', 'D209', 'P210', 'P211']);
    // Only trains leaving Heuston make the departure board.
    expect(toDepartures(board, { service: 'intercity' }).map((d) => d.trainCode.trim())).toEqual(['A210', 'A710', 'A212']); // in due order
  });

  it('files every train on a real Limerick Junction board under a route', async () => {
    const board = await fixtureClient('limerick-junction-midday.xml').getStationData('LMRKJ');
    const headings = toDepartures(board, { service: 'intercity' }).map((d) => [d.trainCode.trim(), intercityHeading('LMRKJ', d)?.route.id]);
    // Ennis to Limerick Junction terminates here, so it isn't a departure.
    expect(Object.fromEntries(headings)).toEqual({ A206: 'corkKerry', A208: 'corkKerry', A211: 'corkKerry', A472: 'limerick' });
    expect(SERVICES.intercity.stations).toBe(INTERCITY_STATIONS);
  });
});
