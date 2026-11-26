import { describe, expect, it } from 'vitest';
import {
  adjacentStations,
  CORK_LINE,
  CORK_STATIONS,
  directionBetween,
  findStationByName,
  type RawStationData,
  route,
  SERVICES,
  stationsAhead,
  terminiFrom,
  toDepartures,
} from '../src';

describe('Cork commuter line', () => {
  it('branches at Glounthaune for Cobh and Midleton', () => {
    expect(adjacentStations('GHANE', CORK_LINE)).toEqual({ north: ['LSLND'], south: ['FOTA', 'CGTWL'] });
    expect(route('COBH', 'MLLOW', CORK_LINE)).toEqual(['COBH', 'RBROK', 'CGLOE', 'FOTA', 'GHANE', 'LSLND', 'CORK', 'MLLOW']);
    expect(route('COBH', 'MDLTN', CORK_LINE)).toBeUndefined();
  });

  it('treats towards Cork and Mallow as northbound, with Cork as a turn-back', () => {
    expect(directionBetween('FOTA', 'CORK', CORK_LINE)).toBe('Northbound');
    expect(directionBetween('CORK', 'MDLTN', CORK_LINE)).toBe('Southbound');
    expect(terminiFrom('LSLND', 'Northbound', CORK_LINE)).toEqual(['CORK', 'MLLOW']);
    expect(terminiFrom('LSLND', 'Southbound', CORK_LINE)).toEqual(['COBH', 'MDLTN']);
    expect(stationsAhead('GHANE', 'Southbound', CORK_LINE)).toEqual(['FOTA', 'CGLOE', 'RBROK', 'COBH', 'CGTWL', 'MDLTN']);
  });

  it('knows every station, with Little Island spelled out', () => {
    expect(CORK_STATIONS).toHaveLength(10);
    expect(findStationByName('Little Island')?.code).toBe('LSLND');
    expect(findStationByName('Cobh')?.code).toBe('COBH');
  });
});

describe('Cork commuter departures', () => {
  const raw = (code: string, origin: string, destination: string, type = 'Train'): RawStationData =>
    ({
      Traincode: code, Stationfullname: 'Glounthaune', Stationcode: 'GHANE', Origin: origin, Destination: destination,
      Status: '', Lastlocation: '', Duein: '5', Late: '0', Exparrival: '', Expdepart: '10:00', Scharrival: '',
      Schdepart: '10:00', Direction: 'To Cork', Traintype: type, Locationtype: 'S',
    }) as RawStationData;

  it('keeps Cork commuter trains and leaves out InterCity and other services', () => {
    const board = [raw('P501', 'Cobh', 'Cork'), raw('D531', 'Mallow', 'Midleton'), raw('A222', 'Dublin Heuston', 'Cork'), raw('P700', 'Dublin Connolly', 'Maynooth')];
    expect(toDepartures(board, { service: 'cork' }).map((d) => d.trainCode)).toEqual(['P501', 'D531']);
    expect(SERVICES.cork.stations).toBe(CORK_STATIONS);
  });
});
