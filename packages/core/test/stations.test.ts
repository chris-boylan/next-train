import { describe, expect, it } from 'vitest';
import { ALL_STATIONS, DART_STATIONS, findStationByCode, findStationByName, resolveStation, searchStations } from '../src';

describe('station data', () => {
  it('derives short names and splits parenthesised aliases', () => {
    const connolly = findStationByCode('cnlly')!;
    expect(connolly.shortName).toBe('Connolly');
    // "Donaghmede ( Howth Junction )": the part matching the station name isn't repeated as an alias.
    expect(findStationByCode('HWTHJ')!.aliases).toEqual(['Donaghmede']);
    expect(findStationByCode('SHILL')!.aliases).toEqual(expect.arrayContaining(['Monkstown', 'Salthill']));
  });

  it('looks up stations by their exact Irish Rail name', () => {
    expect(findStationByName('Dublin Connolly')?.code).toBe('CNLLY');
    expect(findStationByName('Kilcoole')).toBeUndefined();
  });
});

describe('resolveStation', () => {
  it.each([
    ['Connolly', 'CNLLY'],
    ['connoly', 'CNLLY'],
    ['Dublin Connolly', 'CNLLY'],
    ['Connolly Station', 'CNLLY'],
    ['PERSE', 'PERSE'],
    ['pearse', 'PERSE'],
    ['Tara St', 'TARA'],
    ['tara street', 'TARA'],
    ['Dún Laoghaire', 'DLERY'],
    ['dun laoghaire', 'DLERY'],
    ['dunleary', 'DLERY'],
    ['Howth', 'HOWTH'],
    ['howth junction', 'HWTHJ'],
    ['Salthill', 'SHILL'],
    ['greystone', 'GSTNS'],
  ])('%s -> %s', (query, code) => {
    expect(resolveStation(query)?.code).toBe(code);
  });

  it('no longer offers Kilcoole', () => {
    expect(resolveStation('Kilcoole')?.code).not.toBe('KCOOL');
  });

  it('returns undefined for nonsense or empty input', () => {
    expect(resolveStation('xylophone')).toBeUndefined();
    expect(resolveStation('  ')).toBeUndefined();
  });
});

describe('searchStations', () => {
  it('returns every station for an empty query', () => {
    expect(searchStations('')).toHaveLength(DART_STATIONS.length);
  });

  it('ranks prefix matches', () => {
    expect(searchStations('sand').map((s) => s.code)).toEqual(expect.arrayContaining(['SMONT', 'SCOVE']));
  });
});

describe('Irish names', () => {
  it('has an official Irish name for every station, on every service', () => {
    expect(ALL_STATIONS.filter((s) => !s.irishName).map((s) => s.code)).toEqual([]);
  });

  it('uses short forms that mirror the English short name', () => {
    expect(findStationByCode('HWTHJ')!.irishShortName).toBe('Gabhal Bhinn Éadair');
    expect(findStationByCode('BRAY')!.irishShortName).toBe('Bré');
  });

  it('finds stations by Irish name, with or without fadas', () => {
    expect(resolveStation('Bré')?.code).toBe('BRAY');
    expect(resolveStation('binn eadair')?.code).toBe('HOWTH');
    expect(resolveStation('Na Clocha Liatha')?.code).toBe('GSTNS');
  });
});
