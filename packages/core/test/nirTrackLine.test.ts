import { describe, expect, it } from 'vitest';
import { adjacentStations, directionBetween, NIR_TRACK_LINE, SERVICES, terminiFrom } from '../src';

const line = NIR_TRACK_LINE;

describe('NIR_TRACK_LINE', () => {
  it('is the NIR service line, covering every NIR station', () => {
    expect(SERVICES.nir.line).toBe(line);
    for (const s of SERVICES.nir.stations) expect(line.paths.some((p) => p.includes(s.code)), s.code).toBe(true);
  });

  it('runs through Grand Central: Portadown and Newry one way, the rest of Belfast the other', () => {
    expect(directionBetween('BFSTC', 'NEWRY', line)).toBe('Southbound');
    expect(directionBetween('BFSTC', 'NI_BANGR', line)).toBe('Northbound');
    expect(directionBetween('BFSTC', 'NI_DERRY', line)).toBe('Northbound');
    expect(adjacentStations('BFSTC', line)).toEqual({ north: ['NI_CITYH'], south: ['NI_ADELA'] });
  });

  it('agrees with the Enterprise: towards Belfast from Portadown is Northbound', () => {
    expect(directionBetween('PDOWN', 'BFSTC', line)).toBe('Northbound');
    expect(directionBetween('PDOWN', 'NEWRY', line)).toBe('Southbound');
  });

  it('carries trains right through Belfast, e.g. Portadown to Bangor', () => {
    expect(directionBetween('NI_LANYN', 'PDOWN', line)).toBe('Southbound');
    expect(directionBetween('LBURN', 'NI_BANGR', line)).toBe('Northbound');
  });

  it('branches at Lanyon Place, York Street and Coleraine', () => {
    // York Street first, as on the ground: over the Dargan Bridge to the north-west, then Titanic Quarter to the east.
    expect(adjacentStations('NI_LANYN', line).north).toEqual(['NI_YORKG', 'NI_TITQ']);
    expect(adjacentStations('NI_YORKG', line).north.sort()).toEqual(['NI_MOSSW', 'NI_WABBY']);
    expect(adjacentStations('NI_COLER', line).north.sort()).toEqual(['NI_CROCK', 'NI_UNIV']);
    // Derry trains don't call at Whiteabbey, and a Bangor–Larne journey doesn't exist.
    expect(directionBetween('NI_WABBY', 'NI_DERRY', line)).toBeUndefined();
    expect(directionBetween('NI_BANGR', 'NI_LARNH', line)).toBeUndefined();
  });

  it('names where trains go from each side', () => {
    expect(terminiFrom('NI_LANYN', 'Southbound', line)).toEqual(['BFSTC', 'NEWRY']);
    expect(terminiFrom('NI_COLER', 'Northbound', line).sort()).toEqual(['NI_DERRY', 'NI_PRUSH']);
    expect(terminiFrom('NI_BANGR', 'Northbound', line)).toEqual([]);
  });
});
