import { describe, expect, it } from 'vitest';
import { getDepartures, parseDirection, parseStationData, toDepartures } from '../src';
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
