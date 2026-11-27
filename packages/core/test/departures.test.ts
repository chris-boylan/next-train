import { describe, expect, it } from 'vitest';
import { departuresGoingTo, getDepartures, isTracked, parseDirection, parseStationData, toDepartures } from '../src';
import { fixture, fixtureClient } from './fixtures';

describe('toDepartures', () => {
  const midday = parseStationData(fixture('connolly-midday.xml'));

  it('keeps only DARTs that leave the station, soonest first', () => {
    const departures = toDepartures(midday);
    expect(departures.length).toBeGreaterThan(5);
    expect(departures.every((d) => d.trainType === 'DART')).toBe(true);
    expect(departures.some((d) => d.destination === 'Dublin Connolly')).toBe(false);
    const due = departures.map((d) => d.dueInMins);
    expect(due).toEqual([...due].sort((a, b) => a - b));
  });

  it('adds station codes for DART origins and destinations', () => {
    const [first] = toDepartures(midday);
    expect(first?.destinationCode).toMatch(/^[A-Z]{4,5}$/);
    expect(first?.originCode).toMatch(/^[A-Z]{4,5}$/);
  });

  it('trims whitespace from train codes', () => {
    expect(toDepartures(midday)[0]?.trainCode).toMatch(/^\S+$/);
  });

  it('filters by direction', () => {
    const north = toDepartures(midday, { direction: 'Northbound' });
    expect(north.length).toBeGreaterThan(0);
    expect(north.every((d) => d.direction === 'Northbound')).toBe(true);
  });

  it('can include mainline trains', () => {
    expect(toDepartures(midday, { includeTrains: true }).some((d) => d.trainType === 'Train')).toBe(true);
  });

  it('applies a limit', () => {
    expect(toDepartures(midday, { limit: 3 })).toHaveLength(3);
  });

  it('drops terminating trains and orders across midnight by minutes due', () => {
    const departures = toDepartures(parseStationData(fixture('connolly-late-night.xml')));
    expect(departures.map((d) => [d.expectedDepart, d.destination, d.lateMins])).toEqual([
      ['23:58', 'Malahide', 0],
      ['00:05', 'Howth', 7],
    ]);
  });

  it('handles an empty response', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><ArrayOfObjStationData xmlns="http://api.irishrail.ie/realtime/" />';
    expect(toDepartures(parseStationData(xml))).toEqual([]);
  });
});

describe('getDepartures', () => {
  it('fetches and filters through the client', async () => {
    const departures = await getDepartures(fixtureClient('connolly-midday.xml'), 'CNLLY', { limit: 5 });
    expect(departures).toHaveLength(5);
  });
});

describe('parseDirection', () => {
  it.each([
    ['north', 'Northbound'],
    ['N', 'Northbound'],
    ['Southbound', 'Southbound'],
    ['south', 'Southbound'],
    ['sideways', undefined],
    [undefined, undefined],
  ])('%s -> %s', (input, expected) => {
    expect(parseDirection(input)).toBe(expected);
  });
});

describe('departuresGoingTo', () => {
  const at = (destination: string, destinationCode: string, direction = 'Northbound') => ({
    trainCode: destinationCode, origin: '', destination, destinationCode, direction, dueInMins: 1,
    expectedDepart: '', scheduledDepart: '', lateMins: 0, trainType: 'DART', category: 'dart' as const, lastLocation: '',
  });
  const board = [at('Howth', 'HOWTH'), at('Malahide', 'MHIDE'), at('Bray', 'BRAY', 'Southbound'), at('Greystones', 'GSTNS', 'Southbound')];

  it('keeps only trains that stop at the destination', () => {
    expect(departuresGoingTo(board, 'CNLLY', 'SUTTN').map((d) => d.destination)).toEqual(['Howth']);
    expect(departuresGoingTo(board, 'CNLLY', 'RAHNY').map((d) => d.destination)).toEqual(['Howth', 'Malahide']);
  });

  it('drops trains that terminate before the destination', () => {
    expect(departuresGoingTo(board, 'CNLLY', 'GSTNS').map((d) => d.destination)).toEqual(['Greystones']);
    expect(departuresGoingTo(board, 'CNLLY', 'BRAY').map((d) => d.destination)).toEqual(['Bray', 'Greystones']);
  });
});

describe('trainCategory', () => {
  it('labels DART, Enterprise, InterCity and commuter trains at Connolly', () => {
    const all = toDepartures(parseStationData(fixture('connolly-midday.xml')), { includeTrains: true });
    const byCategory = (c: string) => all.filter((d) => d.category === c);
    expect(byCategory('dart').every((d) => d.trainType === 'DART')).toBe(true);
    expect(byCategory('enterprise').every((d) => d.destination === 'Belfast')).toBe(true);
    expect(byCategory('intercity').every((d) => d.trainCode.startsWith('A') && d.destination !== 'Belfast')).toBe(true);
    expect(byCategory('commuter').length).toBeGreaterThan(0);
  });
});

describe('untracked trains', () => {
  it('flags trains with no information well after their start time, and only those', async () => {
    const departures = await getDepartures(fixtureClient('cork-evening.xml'), 'CORK', { includeTrains: true });
    const untracked = departures.filter((d) => d.untracked).map((d) => d.trainCode.trim()).sort();
    // P572 and A313 are untracked too, but they finish at Cork, so they aren't departures there.
    expect(untracked).toEqual(['P529']);
    // A tracked train keeps its live lateness.
    expect(departures.find((d) => d.trainCode.trim() === 'A218')?.untracked).toBeUndefined();
  });

  it("doesn't flag trains that just haven't started yet", async () => {
    const departures = await getDepartures(fixtureClient('tara-evening.xml'), 'TARA');
    expect(departures.length).toBeGreaterThan(10);
    expect(departures.some((d) => d.untracked)).toBe(false);
  });

  it('allows a couple of minutes, and works across midnight', () => {
    const row = (Querytime: string, Origintime: string, Status = 'No Information') => ({ Status, Querytime, Origintime });
    expect(isTracked(row('17:02:00', '17:00'))).toBe(true);
    expect(isTracked(row('17:03:00', '17:00'))).toBe(false);
    expect(isTracked(row('16:30:00', '17:00'))).toBe(true);
    expect(isTracked(row('00:05:00', '23:55'))).toBe(false);
    expect(isTracked(row('23:55:00', '00:05'))).toBe(true);
    expect(isTracked(row('17:30:00', '17:00', 'En Route'))).toBe(true);
  });
});
