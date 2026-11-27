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

  it('runs Heuston–Kildare along the all-stations track, not straight across', () => {
    // It turns down the Kildare line's lane (the commuter stations it skips on that straight run aren't corners).
    const corners = map.bends?.['HSTON|KDARE'] ?? [];
    expect(corners.length).toBeGreaterThanOrEqual(1);
    expect(corners.some(([x]) => x === map.points.KDARE!.x)).toBe(true);
  });

  it('shortens long empty runs, such as Drumcondra to Maynooth, where Sligo trains skip the Western line', () => {
    expect(map.points.DCDRA!.y - map.points.MYNTH!.y).toBeLessThan(200);
  });
});
