import { describe, expect, it } from 'vitest';
import {
  COMMUTER_ROUTES,
  COMMUTER_STATIONS,
  commuterHeading,
  type Departure,
  type RawStationData,
  SERVICES,
  toDepartures,
} from '../src';

const to = (destination: string, destinationCode?: string): Departure => ({
  trainCode: 'P1', origin: '', destination, destinationCode, direction: 'Northbound', dueInMins: 5,
  expectedDepart: '10:00', scheduledDepart: '10:00', lateMins: 0, trainType: 'Train', category: 'commuter', lastLocation: '',
});

describe('Dublin commuter routes', () => {
  it('covers every station once, each with a station record', () => {
    expect(COMMUTER_STATIONS).toHaveLength(70);
    expect(new Set(COMMUTER_STATIONS.map((s) => s.code)).size).toBe(70);
  });

  it('runs every route city end first', () => {
    for (const route of COMMUTER_ROUTES) {
      for (const path of route.line.paths) expect(['CNLLY', 'HSTON', 'GCDK']).toContain(path[0]);
    }
  });
});

describe('commuterHeading', () => {
  it('places trains on the route serving both stations, with the right direction', () => {
    expect(commuterHeading('MHIDE', to('Dundalk', 'DDALK'))).toMatchObject({ route: { id: 'northern' }, outbound: true });
    expect(commuterHeading('MHIDE', to('Dublin Connolly', 'CNLLY'))).toMatchObject({ route: { id: 'northern' }, outbound: false });
    expect(commuterHeading('CLSLA', to('M3 Parkway', 'M3WAY'))).toMatchObject({ route: { id: 'western' }, outbound: true });
    expect(commuterHeading('HZLCH', to('Grand Canal Dock', 'GCDK'))).toMatchObject({ route: { id: 'southWestern' }, outbound: false });
    expect(commuterHeading('CNLLY', to('Gorey', 'GOREY'))).toMatchObject({ route: { id: 'southEastern' }, outbound: true });
  });

  it('files trains heading into the city under this station\'s route', () => {
    // Grand Canal Dock is also on the South Western route, but from Malahide this is a Northern train heading in.
    expect(commuterHeading('MHIDE', to('Grand Canal Dock', 'GCDK'))).toMatchObject({ route: { id: 'northern' }, outbound: false });
  });

  it('places trains running through the city on their destination route', () => {
    // Pearse is on the South Eastern and South Western routes; Drogheda is only on the Northern.
    expect(commuterHeading('PERSE', to('Drogheda', 'DGHDA'))).toMatchObject({ route: { id: 'northern' }, outbound: true });
  });

  it('tells apart the routes running through the city by where the train started', () => {
    const from = (origin: string, originCode: string, destination: string, destinationCode: string): Departure => ({
      ...to(destination, destinationCode),
      origin,
      originCode,
    });
    // Live patterns (Nov 2026): Drogheda, Maynooth and Hazelhatch trains all run through Connolly to Grand Canal Dock.
    expect(commuterHeading('CNLLY', from('Drogheda', 'DGHDA', 'Grand Canal Dock', 'GCDK'))).toMatchObject({ route: { id: 'northern' } });
    expect(commuterHeading('CNLLY', from('Maynooth', 'MYNTH', 'Grand Canal Dock', 'GCDK'))).toMatchObject({ route: { id: 'western' } });
    expect(commuterHeading('CNLLY', from('Hazelhatch', 'HZLCH', 'Grand Canal Dock', 'GCDK'))).toMatchObject({ route: { id: 'southWestern' } });
    expect(commuterHeading('TARA', to('Maynooth', 'MYNTH'))).toMatchObject({ route: { id: 'western' }, outbound: true });
  });

  it('gives up on destinations off the commuter network', () => {
    expect(commuterHeading('CNLLY', to('Longford'))).toBeUndefined();
  });
});

describe('commuter service', () => {
  const raw = (code: string, origin: string, destination: string, type = 'Train'): RawStationData =>
    ({
      Traincode: code, Stationfullname: 'Dublin Connolly', Stationcode: 'CNLLY', Origin: origin, Destination: destination,
      Status: '', Lastlocation: '', Duein: '5', Late: '0', Exparrival: '', Expdepart: '10:00', Scharrival: '',
      Schdepart: '10:00', Direction: 'To Maynooth', Traintype: type, Locationtype: 'S',
    }) as RawStationData;

  it('keeps Dublin commuter trains and leaves out DART, InterCity, Enterprise and Cork', () => {
    const board = [
      raw('P700', 'Dublin Connolly', 'Maynooth'),
      raw('E101', 'Bray', 'Howth', 'DART'),
      raw('A610', 'Dublin Connolly', 'Rosslare Europort'),
      raw('A124', 'Dublin Connolly', 'Belfast'),
      raw('P501', 'Cobh', 'Cork'),
    ];
    expect(toDepartures(board, { service: 'commuter' }).map((d) => d.trainCode)).toEqual(['P700']);
    expect(SERVICES.commuter.stations).toBe(COMMUTER_STATIONS);
  });
});
