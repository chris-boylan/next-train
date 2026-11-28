import { describe, expect, it } from 'vitest';
import { LUAS_GREEN_LINE, LUAS_RED_LINE, LUAS_STATION_CODES } from '@dart-times/core';
import { LUAS_ROUTE_MAP } from '../src/maps/data/luasRoutes';
import { luasAllSchematic, luasGreenSchematic, luasRedSchematic } from '../src/maps/data/luasSchematic';
import type { Schematic } from '../src/maps/data/schematics';

const stopsOf = (paths: string[][]) => [...new Set(paths.flat())].sort();
const edges = (ids: string[]) => LUAS_ROUTE_MAP.routes.filter((r) => ids.includes(r.id)).flatMap((r) => r.edges);

function checkPlaced(schematic: Schematic, codes: string[], routeIds: string[]) {
  const { points, width, height } = schematic;
  expect(Object.keys(points).sort()).toEqual(codes);
  for (const [code, p] of Object.entries(points)) {
    expect(p.x, code).toBeGreaterThanOrEqual(0);
    expect(p.x, code).toBeLessThanOrEqual(width);
    expect(p.y, code).toBeGreaterThanOrEqual(0);
    expect(p.y, code).toBeLessThanOrEqual(height);
  }
  // No two stops drawn on top of each other (the closest are neighbours along a level stretch).
  const all = Object.entries(points);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const [a, p] = all[i]!;
      const [b, q] = all[j]!;
      expect(Math.hypot(p.x - q.x, p.y - q.y), `${a} and ${b}`).toBeGreaterThanOrEqual(18);
    }
  }
  // Every piece of track runs between two placed stops.
  for (const [a, b] of edges(routeIds)) expect(points[a] && points[b], `${a}–${b}`).toBeTruthy();
}

describe('the Luas maps', () => {
  it('places every stop on the combined map, inside it and clear of the others', () => {
    checkPlaced(luasAllSchematic(), [...LUAS_STATION_CODES].sort(), ['red', 'green']);
  });

  it('places every stop on each line\'s own map', () => {
    checkPlaced(luasRedSchematic(), stopsOf(LUAS_RED_LINE.paths), ['red']);
    checkPlaced(luasGreenSchematic(), stopsOf(LUAS_GREEN_LINE.paths), ['green']);
  });

  it('runs the Red line through the Green line\'s loop on the combined map, Abbey Street between its sides', () => {
    const { points } = luasAllSchematic();
    const [abbey, gpo, marlborough] = [points.LU_ABB!, points.LU_OGP!, points.LU_MAR!];
    expect(abbey.x).toBeGreaterThan(gpo.x);
    expect(abbey.x).toBeLessThan(marlborough.x);
    // Jervis west of the loop, Busáras east of it, all on the one level line.
    expect(points.LU_JER!.x).toBeLessThan(gpo.x);
    expect(points.LU_BUS!.x).toBeGreaterThan(marlborough.x);
    expect(new Set([abbey.y, points.LU_JER!.y, points.LU_BUS!.y]).size).toBe(1);
  });

  it('joins Abbey Street to O\'Connell – GPO and Marlborough as a change on foot', () => {
    const transfers = luasAllSchematic().transfers ?? [];
    expect(transfers.map((t) => [t.from, t.to])).toEqual([
      ['LU_ABB', 'LU_OGP'],
      ['LU_ABB', 'LU_MAR'],
    ]);
  });
});
