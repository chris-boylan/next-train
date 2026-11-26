import { describe, expect, it } from 'vitest';
import { buildJourney, irishSecondsOfDay, parseTrainMovements, type RawTrainMovement } from '../src';
import { fixture } from './fixtures';

// E117, Howth → Greystones on 25 Nov 2026, recorded while the train stood at Woodbrook (arrived 15:16:24).
const e117 = parseTrainMovements(fixture('movements-E117.xml'));
const at = (time: string) => Date.parse(`2026-11-25T${time}Z`); // Irish time is UTC in November

describe('buildJourney', () => {
  it('lists the stops from a station to the terminus with expected times', () => {
    const journey = buildJourney(e117, 'BRAY', at('15:17:00'))!;
    expect(journey).toMatchObject({ trainCode: 'E117', origin: 'Howth', destination: 'Greystones' });
    expect(journey.stops).toEqual([
      { code: 'BRAY', name: 'Bray', expected: '15:21', scheduled: '15:09', lateMins: 12, inMins: 4, cancelled: false },
      { code: 'GSTNS', name: 'Greystones', expected: '15:39', scheduled: '15:26', lateMins: 13, inMins: 22, cancelled: false },
    ]);
  });

  it('skips timing points and repeated locations', () => {
    const codes = buildJourney(e117, 'CTARF', at('14:00:00'))!.stops.map((s) => s.code);
    expect(codes.slice(0, 4)).toEqual(['CTARF', 'CNLLY', 'TARA', 'PERSE']);
    expect(codes.filter((c) => c === 'PERSE')).toHaveLength(1);
    expect(codes).not.toContain('EWALL');
  });

  it('knows where the train is: at a platform, having left one, or not yet started', () => {
    expect(buildJourney(e117, 'BRAY', at('15:17:00'))!.now).toEqual({ kind: 'at', code: 'WBROK', name: 'Woodbrook' });

    // Before it reached Woodbrook: the last actual time is leaving Shankill at 15:14:48.
    const earlier = e117.map((m) => (Number(m.LocationOrder) >= 32 ? ({ ...m, Arrival: '', Departure: '' } as RawTrainMovement) : m));
    expect(buildJourney(earlier, 'BRAY', at('15:16:00'))!.now).toEqual({ kind: 'left', code: 'SKILL', name: 'Shankill', minsAgo: 1 });

    const notStarted = e117.map((m) => ({ ...m, Arrival: '', Departure: '' }) as RawTrainMovement);
    expect(buildJourney(notStarted, 'PERSE', at('13:50:00'))!.now).toEqual({ kind: 'notStarted', code: 'HOWTH', name: 'Howth', departs: '13:55' });
  });

  it('returns undefined for a station the train does not call at', () => {
    expect(buildJourney(e117, 'MHIDE', at('15:00:00'))).toBeUndefined();
  });

  it('counts minutes across midnight the short way round', () => {
    const late: RawTrainMovement[] = [
      { ...e117[0]!, LocationCode: 'CNLLY', LocationFullName: 'Dublin Connolly', LocationOrder: '1', LocationType: 'O', ScheduledDeparture: '23:55:00', ExpectedDeparture: '23:58:00', Arrival: '', Departure: '' },
      { ...e117[1]!, LocationCode: 'BRAY', LocationFullName: 'Bray', LocationOrder: '2', LocationType: 'D', ScheduledArrival: '00:30:00', ExpectedArrival: '00:33:00', Arrival: '', Departure: '' },
    ];
    expect(buildJourney(late, 'CNLLY', at('23:50:00'))!.stops.map((s) => [s.code, s.inMins, s.lateMins])).toEqual([
      ['CNLLY', 8, 3],
      ['BRAY', 43, 3],
    ]);
  });
});

describe('irishSecondsOfDay', () => {
  it('uses Irish time, including summer time', () => {
    expect(irishSecondsOfDay(Date.parse('2026-11-25T15:17:00Z'))).toBe(15 * 3600 + 17 * 60);
    expect(irishSecondsOfDay(Date.parse('2026-07-01T15:17:00Z'))).toBe(16 * 3600 + 17 * 60);
  });
});
