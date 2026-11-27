import { describe, expect, it } from 'vitest';
import type { LiveTrain } from '@dart-times/core';
import { alongPath, placeTrains } from '../src/maps/TrainMarkers';

const train = (overrides: Partial<LiveTrain>): LiveTrain => ({
  code: 'T1',
  origin: '',
  destination: '',
  direction: 'Northbound',
  to: 'B',
  progress: 0.5,
  lateMins: 0,
  ...overrides,
});

// A at the left, B to its right, C below B, as on a map whose line turns a corner.
const points: Record<string, { x: number; y: number }> = { A: { x: 0, y: 100 }, B: { x: 100, y: 100 }, C: { x: 100, y: 200 } };
const pointOf = (code: string) => points[code];

describe('alongPath', () => {
  it('walks a path with a corner by length, not by stretch', () => {
    const path: [number, number][] = [[0, 0], [100, 0], [100, 300]];
    expect(alongPath(path, 0.5)).toMatchObject({ x: 100, y: 100, dx: 0, dy: 300 });
    expect(alongPath(path, 0)).toMatchObject({ x: 0, y: 0, dx: 100, dy: 0 });
  });
});

describe('placeTrains', () => {
  // On 27 Nov the InterCity map went blank: a train standing at a station asked the drawn track for the way from
  // that station to itself, got an empty path, and placing it along that threw.
  it('places a train standing at a station when the drawn track gives no way to go along', () => {
    const [atB] = placeTrains([train({ at: 'B', to: 'B' })], pointOf, () => []);
    expect(atB).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(alongPath([], 0.5)).toMatchObject({ dx: 0, dy: 0 });
  });

  it('points straight up or down on a north–south map, whatever the slant', () => {
    const [north] = placeTrains([train({ from: 'A', to: 'C', direction: 'Northbound' })], pointOf);
    expect(north!.angle).toBe(0);
    const [south] = placeTrains([train({ from: 'C', to: 'A', direction: 'Southbound' })], pointOf);
    expect(south!.angle).toBe(180);
  });

  it('points along the track, to the nearest 45°, on maps that run east–west too', () => {
    const [east] = placeTrains([train({ from: 'A', to: 'B' })], pointOf, undefined, 'track');
    expect(east!.angle).toBe(90);
    const [west] = placeTrains([train({ from: 'B', to: 'A' })], pointOf, undefined, 'track');
    expect(west!.angle).toBe(270);
    const [diagonal] = placeTrains([train({ from: 'A', to: 'C' })], pointOf, undefined, 'track');
    expect(diagonal!.angle).toBe(135);
  });

  it('follows the drawn line round a corner', () => {
    const pathOf = () => [[0, 100], [100, 100], [100, 200]] as [number, number][];
    const [p] = placeTrains([train({ from: 'A', to: 'C', progress: 0.75 })], pointOf, pathOf, 'track');
    // Three quarters along: on the downward stretch, facing down, kept left of travel (east of the line).
    expect(p!.angle).toBe(180);
    expect(p!.y).toBeCloseTo(150);
    expect(p!.x).toBeGreaterThan(100);
  });

  it('keeps trains left of the track in their direction of travel', () => {
    const [east] = placeTrains([train({ from: 'A', to: 'B' })], pointOf, undefined, 'track');
    expect(east!.y).toBeLessThan(100);
    const [west] = placeTrains([train({ from: 'B', to: 'A' })], pointOf, undefined, 'track');
    expect(west!.y).toBeGreaterThan(100);
  });
});
