import { describe, expect, it } from 'vitest';
import { NETWORK_EDGES } from '../src/maps/data/network.data';
import { MAP_EDGES, NOT_DRAWN } from '../src/maps/NetworkMap';
import { NETWORK_SCHEMATIC } from '../src/maps/data/networkSchematic';
import { hasNoData, NI_STATIONS, withNorthernTrack } from '../src/maps/data/northernStations';

describe('Northern Ireland track', () => {
  const edges = withNorthernTrack(NETWORK_EDGES);

  it('replaces the generated Belfast–Lisburn shortcut with the stations between', () => {
    const linked = (a: string, b: string) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    expect(linked('BFSTC', 'LBURN')).toBe(false);
    expect(linked('LBURN', 'NI_HILDE')).toBe(true);
    expect(linked('DDALK', 'NEWRY')).toBe(true);
  });

  it('has live data only at Enterprise stops', () => {
    for (const code of ['BFSTC', 'PDOWN', 'NEWRY', 'DDALK', 'CNLLY']) expect(hasNoData(code), code).toBe(false);
    for (const code of ['LBURN', 'MOIRA', 'LURGN', 'NI_DERRY', 'NI_COLER']) expect(hasNoData(code), code).toBe(true);
  });

  it('never uses the other name for Derry', () => {
    expect(NI_STATIONS.some((s) => /london/i.test(s.name))).toBe(false);
  });
});

describe('all-stations map layout', () => {
  const { points, width } = NETWORK_SCHEMATIC;

  it('places every connected station, inside the map', () => {
    for (const code of new Set(MAP_EDGES.flat())) {
      const p = points[code];
      expect(p, code).toBeDefined();
      expect(p!.x, code).toBeGreaterThanOrEqual(0);
      expect(p!.x, code).toBeLessThanOrEqual(width);
    }
  });

  it('draws every line with trains, including Ennis–Athenry, Nenagh and Limerick Junction–Waterford', () => {
    expect(NOT_DRAWN).toEqual([]);
    for (const code of ['CRGHW', 'ARHAN', 'GORT', 'RCREA', 'NNAGH', 'CCONL', 'TIPRY', 'CLMEL', 'CKOSR']) expect(points[code], code).toBeDefined();
  });

  it('gives no two stations the same spot', () => {
    const spots = Object.entries(points).map(([code, p]) => [code, `${p.x},${p.y}`]);
    const seen = new Map<string, string>();
    for (const [code, spot] of spots) {
      expect(seen.get(spot!), `${code} and ${seen.get(spot!)}`).toBeUndefined();
      seen.set(spot!, code!);
    }
  });

  it('keeps north up: Derry above Belfast above Dublin above Cork', () => {
    const y = (code: string) => points[code]!.y;
    expect(y('NI_DERRY')).toBeLessThan(y('BFSTC'));
    expect(y('BFSTC')).toBeLessThan(y('CNLLY'));
    expect(y('CNLLY')).toBeLessThan(y('CORK'));
    expect(y('SLIGO')).toBeLessThan(y('BALNA'));
  });

  it('keeps west left: Westport, Galway and Tralee west of Dublin', () => {
    const x = (code: string) => points[code]!.x;
    for (const code of ['WPORT', 'GALWY', 'TRLEE', 'NI_DERRY']) expect(x(code), code).toBeLessThan(x('CNLLY'));
  });
});
