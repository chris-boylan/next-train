import { describe, expect, it } from 'vitest';
import {
  adjacentStations,
  branchOf,
  callsAt,
  DART_STATIONS,
  directionBetween,
  LINE_ORDER,
  parseStations,
  parseTrainMovements,
  route,
  servedStops,
  stopsBetween,
  terminiFrom,
} from '../src';
import { fixture } from './fixtures';

const stopsOf = (name: string) => servedStops(parseTrainMovements(fixture(name)));

describe('line shape matches recorded train stop lists', () => {
  it('Howth to Greystones (E117)', () => {
    const stops = stopsOf('movements-E117.xml');
    expect(stops).toHaveLength(29);
    expect(route('HOWTH', 'GSTNS')).toEqual(stops);
  });

  it('Greystones to Malahide (E827)', () => {
    expect(route('GSTNS', 'MHIDE')).toEqual(stopsOf('movements-E827.xml'));
  });

  it('skips cancelled stops: E237 was timetabled from Malahide but started at Howth Junction', () => {
    const movements = parseTrainMovements(fixture('movements-E237.xml'));
    expect(movements[0]?.LocationCode).toBe('MHIDE');
    expect(movements[0]?.LocationType).toBe('C');
    const stops = servedStops(movements);
    expect(stops[0]).toBe('HWTHJ');
    expect(route('HWTHJ', 'BRAY')).toEqual(stops);
  });
});

describe('stations', () => {
  it('has 32 stations: 26 on the trunk and 3 on each branch', () => {
    expect(LINE_ORDER).toHaveLength(32);
    expect(new Set(LINE_ORDER).size).toBe(32);
    expect(DART_STATIONS.map((s) => s.code)).toEqual(LINE_ORDER);
    expect(DART_STATIONS.filter((s) => s.branch === 'howth').map((s) => s.code)).toEqual(['HOWTH', 'SUTTN', 'BYSDE']);
  });

  it('includes every API DART station except Kilcoole, which no DART serves', () => {
    const apiCodes = parseStations(fixture('dart-stations.xml')).map((s) => s.StationCode.trim());
    expect(apiCodes.filter((c) => !LINE_ORDER.includes(c))).toEqual(['KCOOL']);
    expect(LINE_ORDER.filter((c) => !apiCodes.includes(c))).toEqual([]);
  });

  it('knows which branch a station is on', () => {
    expect(branchOf('CNLLY')).toBe('trunk');
    expect(branchOf('SUTTN')).toBe('howth');
    expect(branchOf('PMNCK')).toBe('malahide');
    expect(branchOf('KCOOL')).toBeUndefined();
  });
});

describe('route helpers', () => {
  it("knows Connolly's neighbours", () => {
    expect(adjacentStations('CNLLY')).toEqual({ north: ['CTARF'], south: ['TARA'] });
  });

  it('splits north of Howth Junction', () => {
    expect(adjacentStations('HWTHJ')).toEqual({ north: ['BYSDE', 'GRGRD'], south: ['KBRCK'] });
    expect(adjacentStations('BYSDE')).toEqual({ north: ['SUTTN'], south: ['HWTHJ'] });
    expect(adjacentStations('GSTNS')).toEqual({ north: ['BRAY'], south: [] });
    expect(adjacentStations('MHIDE')).toEqual({ north: [], south: ['PMNCK'] });
  });

  it('routes in either direction', () => {
    expect(route('TARA', 'CTARF')).toEqual(['TARA', 'CNLLY', 'CTARF']);
    expect(route('CTARF', 'TARA')).toEqual(['CTARF', 'CNLLY', 'TARA']);
    expect(route('CNLLY', 'CNLLY')).toEqual(['CNLLY']);
  });

  it('has no direct route between the two branches', () => {
    expect(route('SUTTN', 'PMNCK')).toBeUndefined();
    expect(stopsBetween('HOWTH', 'MHIDE')).toBeUndefined();
  });

  it('counts stops and works out direction', () => {
    expect(stopsBetween('CNLLY', 'HOWTH')).toBe(9);
    expect(directionBetween('CNLLY', 'HOWTH')).toBe('Northbound');
    expect(directionBetween('SUTTN', 'BRAY')).toBe('Southbound');
    expect(directionBetween('CNLLY', 'CNLLY')).toBeUndefined();
  });

  it('knows whether a train will call at a station', () => {
    // A Malahide train leaving Connolly calls at Clongriffin, not Sutton.
    expect(callsAt('CNLLY', 'MHIDE', 'GRGRD')).toBe(true);
    expect(callsAt('CNLLY', 'MHIDE', 'SUTTN')).toBe(false);
    // A Bray train doesn't reach Greystones, and a train doesn't "call" where it already is.
    expect(callsAt('CNLLY', 'BRAY', 'GSTNS')).toBe(false);
    expect(callsAt('CNLLY', 'BRAY', 'CNLLY')).toBe(false);
  });

  it('lists where each direction ends up', () => {
    expect(terminiFrom('CNLLY', 'Northbound')).toEqual(['HOWTH', 'MHIDE']);
    expect(terminiFrom('CNLLY', 'Southbound')).toEqual(['BRAY', 'GSTNS']);
    expect(terminiFrom('SUTTN', 'Northbound')).toEqual(['HOWTH']);
    expect(terminiFrom('BRAY', 'Southbound')).toEqual(['GSTNS']);
    expect(terminiFrom('GSTNS', 'Southbound')).toEqual([]);
    expect(terminiFrom('MHIDE', 'Northbound')).toEqual([]);
  });
});
