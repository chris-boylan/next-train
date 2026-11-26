import { describe, expect, it } from 'vitest';
import { INTERCITY_STATION_CODES } from '@dart-times/core';
import { intercitySchematic } from '../src/intercitySchematic';
import { NETWORK_SCHEMATIC } from '../src/networkSchematic';

describe('InterCity map', () => {
  const map = intercitySchematic();

  it('places every InterCity station the all-stations map places', () => {
    const placedThere = INTERCITY_STATION_CODES.filter((c) => NETWORK_SCHEMATIC.points[c]);
    expect(Object.keys(map.points).sort()).toEqual(placedThere.sort());
  });

  it('leaves out only stations on lines the all-stations map has no track for yet', () => {
    const unplaced = INTERCITY_STATION_CODES.filter((c) => !map.points[c]);
    // The Nenagh line, Gort–Craughwell and Limerick Junction–Waterford, when this was written.
    const knownGaps = ['RCREA', 'CJRDN', 'NNAGH', 'BHILL', 'CCONL', 'GORT', 'ARHAN', 'CRGHW', 'TIPRY', 'CAHIR', 'CLMEL', 'CKOSR'];
    for (const code of unplaced) expect(knownGaps).toContain(code);
  });

  it('runs Heuston–Kildare along the all-stations track, through the commuter stations it skips', () => {
    // Heuston to Kildare passes nine commuter stations, each a corner of the InterCity line.
    expect((map.bends?.['HSTON|KDARE'] ?? []).length).toBeGreaterThanOrEqual(9);
  });
});
