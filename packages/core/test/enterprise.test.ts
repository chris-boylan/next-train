import { describe, expect, it } from 'vitest';
import {
  adjacentStations,
  ENTERPRISE_LINE,
  ENTERPRISE_STATIONS,
  findStationByCode,
  parseStationData,
  parseTrainMovements,
  route,
  SERVICES,
  servedStops,
  stationsAhead,
  terminiFrom,
  toDepartures,
} from '../src';
import { fixture } from './fixtures';

const stopsOf = (name: string) => servedStops(parseTrainMovements(fixture(name)));

describe('Enterprise line', () => {
  it('matches recorded Enterprise stop lists in both directions', () => {
    expect(route('CNLLY', 'BFSTC', ENTERPRISE_LINE)).toEqual(stopsOf('movements-A124.xml'));
    expect(route('BFSTC', 'CNLLY', ENTERPRISE_LINE)).toEqual(stopsOf('movements-A121.xml'));
  });

  it('lists stations north to south, sharing Connolly with the DART', () => {
    expect(ENTERPRISE_STATIONS.map((s) => s.code)).toEqual(['BFSTC', 'PDOWN', 'NEWRY', 'DDALK', 'DGHDA', 'CNLLY']);
    expect(findStationByCode('NEWRY')?.name).toBe('Newry');
    expect(SERVICES.enterprise.stations.at(-1)).toBe(SERVICES.dart.stations.find((s) => s.code === 'CNLLY'));
  });

  it('knows neighbours, termini and stations ahead on the Enterprise', () => {
    expect(adjacentStations('CNLLY', ENTERPRISE_LINE)).toEqual({ north: ['DGHDA'], south: [] });
    expect(adjacentStations('NEWRY', ENTERPRISE_LINE)).toEqual({ north: ['PDOWN'], south: ['DDALK'] });
    expect(terminiFrom('DDALK', 'Northbound', ENTERPRISE_LINE)).toEqual(['BFSTC']);
    expect(terminiFrom('BFSTC', 'Northbound', ENTERPRISE_LINE)).toEqual([]);
    expect(stationsAhead('DDALK', 'Southbound', ENTERPRISE_LINE)).toEqual(['DGHDA', 'CNLLY']);
  });
});

describe('Enterprise departures', () => {
  const connolly = parseStationData(fixture('connolly-midday.xml'));

  it('keeps only trains to or from Belfast, dropping ones that terminate here', () => {
    const departures = toDepartures(connolly, { service: 'enterprise' });
    expect(departures.length).toBeGreaterThan(0);
    expect(departures.every((d) => d.destination === 'Belfast')).toBe(true);
    expect(departures.every((d) => d.destinationCode === 'BFSTC')).toBe(true);
  });

  it('leaves DART results unchanged by default', () => {
    expect(toDepartures(connolly).every((d) => d.trainType === 'DART')).toBe(true);
  });
});
