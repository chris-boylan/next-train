import { describe, expect, it } from 'vitest';
import { DART_LINE, LIVE_WINDOW_MINS, type ScheduledDeparture, scheduledBeyondLive, scheduledHeading } from '../src';

const dep = (trainCode: string, minutes: number, destinationCode?: string, category: ScheduledDeparture['category'] = 'dart'): ScheduledDeparture => ({
  trainCode,
  minutes,
  time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  destinationCode,
  destination: destinationCode ?? 'Somewhere',
  category,
});

describe('scheduledBeyondLive', () => {
  const now = 12 * 60; // 12:00
  const timetable = [dep('E1', now + 30), dep('E2', now + LIVE_WINDOW_MINS), dep('E3', now + LIVE_WINDOW_MINS + 1), dep('E4', now + 120), dep('E5', now + 150)];

  it('only shows trains beyond the live window, where live data has nothing to say', () => {
    expect(scheduledBeyondLive(timetable, { nowMinutes: now, liveCodes: new Set() }).map((d) => d.trainCode)).toEqual(['E3', 'E4', 'E5']);
  });

  it('never repeats a train that is already shown live', () => {
    expect(scheduledBeyondLive(timetable, { nowMinutes: now, liveCodes: new Set(['E3']) }).map((d) => d.trainCode)).toEqual(['E4', 'E5']);
  });

  it('applies the filter and the limit', () => {
    const picked = scheduledBeyondLive(timetable, { nowMinutes: now, liveCodes: new Set(), include: (d) => d.trainCode !== 'E4', limit: 1 });
    expect(picked.map((d) => d.trainCode)).toEqual(['E3']);
    expect(scheduledBeyondLive(timetable, { nowMinutes: now, liveCodes: new Set(), limit: 0 })).toEqual([]);
  });
});

describe('scheduledHeading', () => {
  const at = { service: 'dart' as const, station: 'CNLLY', line: DART_LINE };

  it('puts trains on the track towards their destination', () => {
    expect(scheduledHeading(dep('E1', 0, 'BRAY'), { ...at, direction: 'Southbound' })).toBe(true);
    expect(scheduledHeading(dep('E1', 0, 'BRAY'), { ...at, direction: 'Northbound' })).toBe(false);
    expect(scheduledHeading(dep('E2', 0, 'HOWTH'), { ...at, direction: 'Northbound' })).toBe(true);
  });

  it("leaves out other services' trains and unknown destinations", () => {
    expect(scheduledHeading(dep('A1', 0, 'BRAY', 'intercity'), { ...at, direction: 'Southbound' })).toBe(false);
    expect(scheduledHeading(dep('E1', 0, undefined), { ...at, direction: 'Southbound' })).toBe(false);
  });

  it('with a going-to stop, keeps only trains that call there', () => {
    const toDunLaoghaire = { ...at, direction: 'Southbound' as const, goingTo: 'DLERY' };
    expect(scheduledHeading(dep('E1', 0, 'GSTNS'), toDunLaoghaire)).toBe(true);
    expect(scheduledHeading(dep('E1', 0, 'DLERY'), toDunLaoghaire)).toBe(true);
    expect(scheduledHeading(dep('E1', 0, 'MHIDE'), { ...at, direction: 'Northbound', goingTo: 'HOWTH' })).toBe(false);
  });
});
