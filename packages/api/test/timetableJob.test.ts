import { describe, expect, it } from 'vitest';
import type { GtfsFiles } from '@dart-times/core';
import { GTFS_REMIND_DAYS, GTFS_STALE_DAYS, remindAboutGtfs } from '../src/timetableJob';

const CAL = 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date';
const gtfs = (calendar: string[], dates: string[] = [], published?: string): GtfsFiles => ({
  stops: '',
  routes: '',
  trips: '',
  stopTimes: '',
  calendar: [CAL, ...calendar].join('\n'),
  calendarDates: ['service_id,date,exception_type', ...dates].join('\n'),
  ...(published ? { feedInfo: `feed_publisher_name,feed_start_date,feed_end_date\nNTA,${published},20271126` } : {}),
});

describe('remindAboutGtfs', () => {
  // Like the real feed: trains for most of a year, republished yesterday.
  const fresh = gtfs(['WK,1,1,1,1,1,0,0,20261126,20270917', 'ONE,0,0,0,0,0,1,0,20261128,20261128'], [], '20261126');

  it('stays quiet while the feed is fresh and has trains for weeks ahead', () => {
    return expect(remindAboutGtfs(fresh, '20261127', undefined)).resolves.toBeUndefined();
  });

  it(`warns within ${GTFS_REMIND_DAYS} days of the last train, and after it`, async () => {
    const ending = gtfs(['WK,1,1,1,1,1,0,0,20261101,20261205']);
    expect(await remindAboutGtfs(ending, '20261127', undefined)).toMatch(/runs out on 20261205 \(8 days\)/);
    expect(await remindAboutGtfs(ending, '20261206', undefined)).toMatch(/ran out on 20261205/);
  });

  it('counts dates added in calendar_dates, but not calendars that never run', async () => {
    const added = gtfs(['WK,1,1,1,1,1,0,0,20261101,20261205', 'NONE,0,0,0,0,0,0,0,20261101,20271231'], ['X,20270301,1', 'WK,20270401,2']);
    expect(await remindAboutGtfs(added, '20261127', undefined)).toBeUndefined();
    expect(await remindAboutGtfs(gtfs(['NONE,0,0,0,0,0,0,0,20261101,20271231']), '20261127', undefined)).toMatch(/no trains/);
  });

  it(`warns when the NTA hasn't republished for ${GTFS_STALE_DAYS} days`, async () => {
    const stale = gtfs(['WK,1,1,1,1,1,0,0,20261101,20270917'], [], '20261101');
    expect(await remindAboutGtfs(stale, '20261114', undefined)).toBeUndefined();
    expect(await remindAboutGtfs(stale, '20261115', undefined)).toMatch(/hasn't republished .* since 20261101 \(14 days\)/);
  });
});
