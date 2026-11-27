import { describe, expect, it } from 'vitest';
import { INTERCITY_STATION_CODES } from '@dart-times/core';
import { intercitySchematic } from '../src/maps/data/intercitySchematic';
import { NENAGH_END, NETWORK_SCHEMATIC } from '../src/maps/data/networkSchematic';

describe('InterCity map', () => {
  const map = intercitySchematic();

  it('places every InterCity station the all-stations map places, plus its Nenagh line Ballybrophy stop', () => {
    const placedThere = INTERCITY_STATION_CODES.filter((c) => NETWORK_SCHEMATIC.points[c]);
    expect(Object.keys(map.points).sort()).toEqual([...placedThere, NENAGH_END].sort());
    expect(map.standIns?.map((s) => s.for)).toEqual(['BBRHY']);
  });

  it('places every InterCity station, the Nenagh, Ennis–Athenry and Limerick Junction–Waterford lines included', () => {
    expect(INTERCITY_STATION_CODES.filter((c) => !map.points[c])).toEqual([]);
  });

  it('runs Heuston–Kildare along the all-stations track, through the commuter stations it skips', () => {
    // Heuston to Kildare passes nine commuter stations, each a corner of the InterCity line.
    expect((map.bends?.['HSTON|KDARE'] ?? []).length).toBeGreaterThanOrEqual(9);
  });
});
