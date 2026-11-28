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
    // Kilcoole isn't on the DART (the API lists it there by mistake) but is on the South Eastern commuter line.
    expect(findStationByName('Kilcoole')?.code).toBe('KCOOL');
    expect(DART_STATIONS.some((s) => s.code === 'KCOOL')).toBe(false);
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
    // NI Railways stations named after buildings or developments (City Hospital, Lanyon Place…) stay in English,
    // as do Luas stops without a published Irish name yet (see stations.ga.ts).
    expect(ALL_STATIONS.filter((s) => !s.irishName && !s.code.startsWith('NI_') && !s.code.startsWith('LU_')).map((s) => s.code)).toEqual([]);
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

describe('Belfast Grand Central', () => {
  it("shows the station's own name but still matches the API's \"Belfast\"", () => {
    const station = findStationByName('Belfast');
    expect(station?.code).toBe('BFSTC');
    expect(station?.name).toBe('Belfast Grand Central');
    expect(findStationByName('Belfast Grand Central')?.code).toBe('BFSTC');
    expect(searchStations('grand central', ALL_STATIONS).map((s) => s.code)).toContain('BFSTC');
  });
});

describe('official station names', () => {
  it('finds stations by their official commemorative names', () => {
    const codes = (q: string) => searchStations(q, ALL_STATIONS).map((s) => s.code);
    expect(codes('Kent')).toContain('CORK');
    expect(codes('kent station')).toContain('CORK');
    expect(codes('Cork Kent')).toContain('CORK');
    expect(codes('Ceannt')).toContain('GALWY');
    expect(codes('Colbert')).toContain('LMRCK');
    expect(codes('Clarke')).toContain('DDALK');
    expect(codes('Daly')).toContain('BRAY');
    expect(codes("O'Hanrahan")).toContain('WXFRD');
  });

  it('gives a subtitle where the official name differs from the place name, but not for Dublin', () => {
    expect(findStationByCode('CORK')?.officialName).toBe('Kent Station');
    expect(findStationByCode('SLIGO')?.officialName).toBe('Mac Diarmada Station');
    expect(findStationByCode('CNLLY')?.officialName).toBeUndefined();
    expect(findStationByCode('HOWTH')?.officialName).toBeUndefined();
  });
});

describe('searchStations from the first letter', () => {
  const codes = (q: string) => searchStations(q).map((s) => s.code);

  it('lists names starting with one or two letters first', () => {
    expect(codes('b').slice(0, 4).sort()).toEqual(['BRAY', 'BROCK', 'BTSTN', 'BYSDE']);
    expect(codes('ho')).toEqual(['HOWTH', 'HWTHJ']);
  });

  it('then names with a later word starting with them, then Irish names', () => {
    const m = codes('m');
    expect(m[0]).toBe('MHIDE');
    expect(m[1]).toBe('SHILL');
    // Howth's Irish name, Binn Éadair, still finds it, after the English matches.
    const b = codes('b');
    expect(b).toContain('HOWTH');
    expect(b.indexOf('HOWTH')).toBeGreaterThan(b.indexOf('BRAY'));
  });

  it('leaves nicknames and typos for three letters and more', () => {
    expect(codes('xq')).toEqual([]);
    expect(codes('b')).not.toContain('GCDK'); // Barrow Street
    expect(codes('barrow')).toContain('GCDK');
    expect(resolveStation('connoly')?.code).toBe('CNLLY');
  });
});
