import { describe, expect, it } from 'vitest';
import { buildTimetable, matchStops, parseCsv, scheduledBetween, scheduledCategory, servicesOn, type Station } from '../src';

const station = (code: string, name: string, lat: number, lon: number): Station =>
  ({ code, name, shortName: name, aliases: [], branch: 'trunk', lat, lon }) as Station;

const STATIONS = [
  station('PERSE', 'Dublin Pearse', 53.3433, -6.2481),
  station('BRAY', 'Bray', 53.2037, -6.1002),
  station('CORK', 'Cork', 51.9018, -8.4582),
];

// A tiny GTFS: one DART each way on weekdays, one cancelled on 2026-12-25, one running past midnight.
const files = {
  stops: [
    'stop_id,stop_code,stop_name,stop_lat,stop_lon',
    'S1,1,Dublin Pearse,53.343252,-6.248048',
    'S2,2,"Bray (Daly)",53.203712,-6.100194',
    'S3,3,Cork (Kent),51.901363,-8.458343',
    'S9,9,Nowhere,52.0,-7.0',
  ].join('\n'),
  routes: 'route_id,route_short_name\nBRAY-HOWTH-I,DART\nDUB-CORK-O,InterCity',
  trips: [
    'route_id,service_id,trip_id,trip_headsign,trip_short_name',
    'BRAY-HOWTH-I,WK,T1,Bray (Daly),E200',
    'BRAY-HOWTH-I,WK,T2,Bray (Daly),E202',
    'DUB-CORK-O,WK,T3,Cork (Kent),A200',
    'BRAY-HOWTH-I,SUN,T4,Bray (Daly),E900',
    'BRAY-HOWTH-I,WK,T5,Dublin Pearse,E204',
  ].join('\n'),
  stopTimes: [
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type',
    'T1,10:00:00,10:01:00,S1,1,0',
    'T1,10:30:00,10:30:00,S2,2,1',
    'T2,23:50:00,23:51:00,S1,1,0',
    'T2,24:20:00,24:20:00,S2,2,1',
    'T3,09:00:00,09:00:00,S1,1,0',
    'T3,12:00:00,12:00:00,S3,2,1',
    'T4,08:00:00,08:00:00,S1,1,0',
    'T4,08:30:00,08:30:00,S2,2,1',
    'T5,24:05:00,24:05:00,S2,1,0',
    'T5,24:40:00,24:40:00,S1,2,1',
  ].join('\r\n'),
  calendar: [
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date',
    'WK,1,1,1,1,1,0,0,20261101,20271130',
    'SUN,0,0,0,0,0,0,1,20261101,20271130',
  ].join('\n'),
  calendarDates: 'service_id,date,exception_type\nWK,20261225,2',
};

describe('timetable (GTFS)', () => {
  it('parses quoted CSV fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });

  it('works out which services run on a date, with exceptions', () => {
    const calendar = parseCsv(files.calendar);
    const dates = parseCsv(files.calendarDates);
    expect([...servicesOn(calendar, dates, '20261127')]).toEqual(['WK']); // a Friday
    expect([...servicesOn(calendar, dates, '20261129')]).toEqual(['SUN']);
    expect([...servicesOn(calendar, dates, '20261225')]).toEqual([]); // Christmas Day: WK removed
  });

  it('matches stops to our stations by position, or by name when coordinates differ', () => {
    const far = [...STATIONS.slice(0, 2), station('CORK', 'Cork', 51.9105, -8.4582)]; // ~1 km out
    const matches = matchStops(parseCsv(files.stops), far);
    expect(Object.fromEntries(matches)).toEqual({ S1: 'PERSE', S2: 'BRAY', S3: 'CORK' });
  });

  it('lists departures per station, without arrivals where trains terminate', () => {
    const tt = buildTimetable(files, '20261127', STATIONS);
    expect(tt.byStation.PERSE!.map((d) => [d.time, d.trainCode, d.destinationCode, d.category])).toEqual([
      ['09:00', 'A200', 'CORK', 'intercity'],
      ['10:01', 'E200', 'BRAY', 'dart'],
      ['23:51', 'E202', 'BRAY', 'dart'],
    ]);
    expect(tt.byStation.BRAY!.map((d) => [d.time, d.minutes, d.trainCode])).toEqual([['00:05', 1445, 'E204']]);
    expect(tt.byStation.PERSE![0]!.destination).toBe('Cork (Kent)');
  });

  it('finds departures in a window, including trains still running after midnight', () => {
    const friday = buildTimetable(files, '20261127', STATIONS);
    const saturday = buildTimetable(files, '20261128', STATIONS);
    expect(scheduledBetween('PERSE', friday, undefined, 9 * 60, 11 * 60).map((d) => d.trainCode)).toEqual(['A200', 'E200']);
    // Saturday has no weekday trains, but Friday's 24:05 from Bray is Saturday 00:05.
    expect(scheduledBetween('PERSE', saturday, friday, 0, 24 * 60)).toEqual([]);
    expect(scheduledBetween('BRAY', saturday, friday, 0, 60).map((d) => [d.time, d.minutes, d.trainCode])).toEqual([['00:05', 5, 'E204']]);
  });

  it('categorises trains as the live API does', () => {
    expect(scheduledCategory('E200', 'BRAY-HOWTH-I')).toBe('dart');
    expect(scheduledCategory('A200', 'DUB-CORK-O')).toBe('intercity');
    expect(scheduledCategory('A100', 'DUB-BFT-O')).toBe('enterprise');
    expect(scheduledCategory('P660', 'DUB-DRO/DUN-O')).toBe('commuter');
  });
});

describe('scheduledMatches', () => {
  const d = (category: 'dart' | 'commuter' | 'intercity' | 'enterprise', destinationCode: string) =>
    ({ time: '10:00', minutes: 600, trainCode: 'X', destinationCode, destination: '', category }) as const;
  it('sorts timetabled trains into services like live ones', async () => {
    const { scheduledMatches } = await import('../src');
    expect(scheduledMatches('dart', d('dart', 'BRAY'))).toBe(true);
    expect(scheduledMatches('cork', d('commuter', 'COBH'))).toBe(true);
    expect(scheduledMatches('commuter', d('commuter', 'COBH'))).toBe(false);
    expect(scheduledMatches('commuter', d('commuter', 'MYNTH'))).toBe(true);
    expect(scheduledMatches('intercity', d('intercity', 'CORK'))).toBe(true);
    expect(scheduledMatches('enterprise', d('enterprise', 'BFSTC'))).toBe(true);
  });
});
