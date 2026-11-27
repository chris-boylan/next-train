import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_STATIONS,
  buildNirTimetable,
  durationMins,
  LIVE_WINDOW_MINS,
  liveWindowFor,
  mergeTimetables,
  parseTransXChange,
  runsOn,
  type ScheduledDeparture,
  scheduledBeyondLive,
  scheduledMatches,
} from '../src';

const xml = readFileSync(new URL('./fixtures/nir-sample.xml', import.meta.url), 'latin1');
const txc = parseTransXChange(xml);

describe('parseTransXChange', () => {
  it('reads stops, and NIR journeys but not the Enterprise (Irish Rail has it)', () => {
    expect(txc.stops.map((s) => s.code)).toEqual(['9000BR6', '9000HW4', '9000SY3', '70009000GCP3', '9000DN2']);
    expect(txc.journeys.map((j) => j.code)).toEqual(['VJ_WEEKDAY', 'VJ_LATE']);
    expect(txc.journeys[0]!.links).toHaveLength(3);
  });

  it('knows when the NIR timetable runs out (ignoring the Enterprise service)', () => {
    expect(txc.validUntil).toBe('20261213');
  });

  it('reads ISO durations', () => {
    expect(durationMins('PT2M')).toBe(2);
    expect(durationMins('PT3M30S')).toBe(3.5);
    expect(durationMins('PT2H10M')).toBe(130);
    expect(durationMins(undefined)).toBe(0);
  });
});

describe('runsOn', () => {
  const [weekday, late] = txc.journeys as [(typeof txc.journeys)[0], (typeof txc.journeys)[0]];
  it('follows the journey’s own days, within the service’s operating period', () => {
    expect(runsOn(weekday, '20261127')).toBe(true); // Friday
    expect(runsOn(weekday, '20261128')).toBe(false); // Saturday
    expect(runsOn(late, '20261128')).toBe(true);
    expect(runsOn(weekday, '20261218')).toBe(false); // after the period
  });

  it('skips days of non-operation', () => {
    expect(runsOn(weekday, '20261204')).toBe(true);
    expect(runsOn(weekday, '20261208')).toBe(false);
  });
});

describe('buildNirTimetable', () => {
  const friday = buildNirTimetable(txc, '20261127', ALL_STATIONS);

  it('matches stops to our stations and times each one along the pattern', () => {
    // Bangor 07:17, Holywood 07:17 + 12 run + 1 wait = 07:30; Sydenham is passed; Grand Central is the end.
    expect(friday.byStation['NI_BANGR']).toEqual([
      { time: '07:17', minutes: 437, trainCode: 'VJ_WEEKDAY', destinationCode: 'BFSTC', destination: 'Grand Central', category: 'nir' },
    ]);
    expect(friday.byStation['NI_HWOOD']?.map((d) => d.time)).toEqual(['07:30']);
    expect(friday.byStation['NI_SYDEN']).toBeUndefined();
    expect(friday.byStation['BFSTC']).toBeUndefined();
  });

  it('runs past midnight on the same service day', () => {
    const saturday = buildNirTimetable(txc, '20261128', ALL_STATIONS);
    expect(saturday.byStation['NI_HWOOD']).toEqual([expect.objectContaining({ time: '00:08', minutes: 1448 })]);
  });

  it('merges with other sources by station, in time order', () => {
    const other: ScheduledDeparture = { time: '07:00', minutes: 420, trainCode: 'A1', destination: 'X', category: 'enterprise' };
    const merged = mergeTimetables('20261127', [friday, { date: '20261127', byStation: { NI_BANGR: [other] } }]);
    expect(merged.byStation['NI_BANGR']?.map((d) => d.trainCode)).toEqual(['A1', 'VJ_WEEKDAY']);
  });
});

describe('NI Railways in the live/timetable hierarchy', () => {
  const nir: ScheduledDeparture = { time: '12:10', minutes: 730, trainCode: 'VJ', destination: 'Bangor', category: 'nir' };
  const enterprise: ScheduledDeparture = { ...nir, trainCode: 'A1', category: 'enterprise' };

  it('shows NIR trains from now, since NIR has no live data, but Irish Rail ones only beyond the live window', () => {
    expect(liveWindowFor(nir)).toBe(0);
    expect(liveWindowFor(enterprise)).toBe(LIVE_WINDOW_MINS);
    const picked = scheduledBeyondLive([nir, enterprise], { nowMinutes: 12 * 60, liveCodes: new Set() });
    expect(picked.map((d) => d.trainCode)).toEqual(['VJ']);
  });

  it('belongs to the NIR service', () => {
    expect(scheduledMatches('nir', nir)).toBe(true);
    expect(scheduledMatches('enterprise', nir)).toBe(false);
  });
});
