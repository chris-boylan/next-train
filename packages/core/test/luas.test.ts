import { describe, expect, it } from 'vitest';
import { adjacentStations, directionBetween, terminiFrom } from '../src/line';
import { getLuasStatus, isLuasDisruption, luasJourney, LUAS_GREEN_LINE, LUAS_LINE, LUAS_RED_LINE, LUAS_STATION_CODES, luasUnservedAt, toLuasDepartures } from '../src/luas';
import { LuasClient, parseLuasForecast, parseLuasStops } from '../src/luasClient';
import { SERVICES } from '../src/services';
import { findStationByCode, findStationByName, LUAS_STATIONS, searchStations } from '../src/stations';
import { fixture } from './fixtures';

// Recorded from the Luas Forecasting API on 28 Nov 2026, when the Red line was suspended between Red Cow and
// Tallaght/Saggart (every Red stop said "See news"). forecast-bel-constructed.xml is built by hand in the feed's
// exact format, for a normal Red line answer.
const NOW = Date.parse('2026-11-28T13:00:00Z');
const departuresAt = (file: string, code: string) => toLuasDepartures(parseLuasForecast(fixture(`luas/${file}`)), code, LUAS_STATIONS, NOW);

describe('Luas stops', () => {
  it('has every stop the feed lists on a line, and every stop on a line in the data', () => {
    const feed = parseLuasStops(fixture('luas/stops.xml'));
    expect(feed.filter((s) => s.line === 'red')).toHaveLength(32);
    expect(feed.filter((s) => s.line === 'green')).toHaveLength(35);
    expect(feed.map((s) => `LU_${s.abrev}`).sort()).toEqual([...LUAS_STATION_CODES].sort());
    expect(LUAS_STATIONS.map((s) => s.code).sort()).toEqual([...LUAS_STATION_CODES].sort());
    expect(SERVICES.luas.stations).toBe(LUAS_STATIONS);
  });

  it('shows dashes as dashes, and finds stops by the names people use', () => {
    expect(findStationByCode('LU_OGP')!.name).toBe("O'Connell – GPO");
    expect(findStationByName("O'Connell - GPO", LUAS_STATIONS)!.code).toBe('LU_OGP');
    expect(searchStations('stephens green', LUAS_STATIONS)[0]!.code).toBe('LU_STS');
    expect(searchStations('gpo', LUAS_STATIONS)[0]!.code).toBe('LU_OGP');
  });

  it('leaves railway stations of the same name to the railways', () => {
    expect(findStationByName('Broombridge')!.code).toBe('BBRDG');
  });
});

describe('Luas lines', () => {
  it('runs inbound (up) towards the city on both lines', () => {
    expect(directionBetween('LU_TAL', 'LU_TPT', LUAS_RED_LINE)).toBe('Northbound');
    expect(directionBetween('LU_SAG', 'LU_CON', LUAS_RED_LINE)).toBe('Northbound');
    expect(directionBetween('LU_RAN', 'LU_BRO', LUAS_GREEN_LINE)).toBe('Northbound');
    expect(directionBetween('LU_RAN', 'LU_BRI', LUAS_GREEN_LINE)).toBe('Southbound');
  });

  it('branches at Belgard and Busáras, and goes round the city-centre loop one way each side', () => {
    expect(adjacentStations('LU_BEL', LUAS_LINE).south.sort()).toEqual(['LU_COO', 'LU_FET']);
    expect(adjacentStations('LU_BUS', LUAS_LINE).north.sort()).toEqual(['LU_CON', 'LU_GDK']);
  });

  it("runs the city-centre loop one way each side, as the feed serves it", () => {
    // Next stations only where trams go: northbound by Westmoreland and O'Connell, southbound by Parnell,
    // Marlborough and Trinity; O'Connell – Upper leads on to Dominick or round into Parnell.
    expect(adjacentStations('LU_WES', LUAS_LINE)).toEqual({ north: ['LU_OGP'], south: [] });
    expect(adjacentStations('LU_MAR', LUAS_LINE)).toEqual({ north: [], south: ['LU_TRY'] });
    expect(adjacentStations('LU_OUP', LUAS_LINE)).toEqual({ north: ['LU_DOM', 'LU_PAR'], south: [] });
    expect(adjacentStations('LU_PAR', LUAS_LINE)).toEqual({ north: [], south: ['LU_MAR'] });
    expect(adjacentStations('LU_DAW', LUAS_LINE)).toEqual({ north: ['LU_WES'], south: ['LU_STS'] });
    expect(adjacentStations('LU_DOM', LUAS_LINE)).toEqual({ north: ['LU_BRD'], south: ['LU_PAR'] });
    // Where trams go from each side: Westmoreland only towards Broombridge and Parnell, Trinity only south.
    expect(terminiFrom('LU_WES', 'Northbound', LUAS_LINE).sort()).toEqual(['LU_BRO', 'LU_PAR']);
    expect(terminiFrom('LU_WES', 'Southbound', LUAS_LINE)).toEqual([]);
    expect(terminiFrom('LU_TRY', 'Northbound', LUAS_LINE)).toEqual([]);
    expect(terminiFrom('LU_RAN', 'Northbound', LUAS_LINE).sort()).toEqual(['LU_BRO', 'LU_PAR']);
    expect(luasUnservedAt('LU_WES')).toBe('Southbound');
    expect(luasUnservedAt('LU_PAR')).toBe('Northbound');
    expect(luasUnservedAt('LU_DAW')).toBeUndefined();
  });
});

describe('Luas departures', () => {
  it('puts trams on their track by where they go: inbound up, outbound down', () => {
    const { departures, disrupted, noService } = departuresAt('forecast-ran.xml', 'LU_RAN');
    expect(disrupted).toBe(false);
    expect(noService).toEqual([]);
    expect(departures).toHaveLength(11);
    const parnell = departures.find((d) => d.destinationCode === 'LU_PAR')!;
    expect(parnell).toMatchObject({ direction: 'Northbound', dueInMins: 2, category: 'luas', lateMins: 0, expectedDepart: '13:02' });
    expect(departures.filter((d) => d.destinationCode === 'LU_BRI').every((d) => d.direction === 'Southbound')).toBe(true);
    expect(departures.map((d) => d.dueInMins)).toEqual([...departures.map((d) => d.dueInMins)].sort((a, b) => a - b));
  });

  it('gives each tram the same ID from one refresh to the next while its estimate holds', () => {
    const a = departuresAt('forecast-ran.xml', 'LU_RAN').departures.map((d) => d.trainCode);
    expect(new Set(a).size).toBe(a.length);
    expect(departuresAt('forecast-ran.xml', 'LU_RAN').departures.map((d) => d.trainCode)).toEqual(a);
  });

  it('says which track has no trams at a one-way stop on the city-centre loop', () => {
    const { departures, noService } = departuresAt('forecast-wes.xml', 'LU_WES');
    expect(noService).toEqual(['Southbound']);
    expect(departures.length).toBeGreaterThan(0);
    expect(departures.every((d) => d.direction === 'Northbound')).toBe(true);
  });

  it('shows no trams, and the line status, during a disruption', () => {
    const { departures, message, disrupted } = departuresAt('forecast-bus.xml', 'LU_BUS');
    expect(departures).toEqual([]);
    expect(disrupted).toBe(true);
    expect(message).toBe('No service Red Cow – Tallaght / Saggart. See news.');
  });

  it('reads DUE as now, and sends Tallaght and Saggart trams down from Belgard', () => {
    const { departures } = departuresAt('forecast-bel-constructed.xml', 'LU_BEL');
    expect(departures[0]).toMatchObject({ destinationCode: 'LU_TPT', dueInMins: 0, direction: 'Northbound' });
    expect(departures.filter((d) => d.direction === 'Southbound').map((d) => d.destinationCode).sort()).toEqual(['LU_SAG', 'LU_TAL']);
    expect(departures.find((d) => d.destinationCode === 'LU_CON')!.direction).toBe('Northbound');
  });
});

describe('LuasClient', () => {
  it('asks for a stop by the feed code, caches it briefly, and retries after a failure', async () => {
    const urls: string[] = [];
    let fail = true;
    let now = 0;
    const client = new LuasClient({
      now: () => now,
      fetch: async (url) => {
        urls.push(String(url));
        if (fail) {
          fail = false;
          return new Response('nope', { status: 503 });
        }
        return new Response(fixture('luas/forecast-ran.xml'));
      },
    });
    await expect(client.getForecast('ran')).rejects.toThrow('503');
    await new Promise((r) => setTimeout(r, 0));
    expect((await client.getForecast('RAN')).stop).toBe('Ranelagh');
    await client.getForecast('RAN');
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('action=forecast&stop=RAN&encrypt=false');
    now = 30_000;
    await client.getForecast('RAN');
    expect(urls).toHaveLength(3);
  });
});

describe('Luas line status', () => {
  it('counts anything but "operating normally" as news', () => {
    expect(isLuasDisruption('Green Line services operating normally')).toBe(false);
    expect(isLuasDisruption('Green Line services operating with delays')).toBe(true);
    expect(isLuasDisruption('No service Red Cow – Tallaght / Saggart. See news.')).toBe(true);
    expect(isLuasDisruption('')).toBe(false);
  });

  it("reads each line's status from one of its stops, leaving out a line whose forecast fails", async () => {
    const asked: string[] = [];
    const client = new LuasClient({
      fetch: async (url) => {
        const stop = new URL(String(url)).searchParams.get('stop')!;
        asked.push(stop);
        if (stop === 'MAR') return new Response('', { status: 503 });
        return new Response(fixture('luas/forecast-jer.xml'));
      },
    });
    const errors = console.error;
    console.error = () => {};
    try {
      expect(await getLuasStatus(client)).toEqual({
        red: { message: 'No service Red Cow – Tallaght / Saggart. See news.', disrupted: true },
      });
    } finally {
      console.error = errors;
    }
    expect(asked.sort()).toEqual(['JER', 'MAR']);
  });
});

describe('A tram\'s stops ahead, estimated', () => {
  const tram = (direction: 'Northbound' | 'Southbound', destinationCode: string) =>
    ({ trainCode: 'x', destination: destinationCode, destinationCode, direction, category: 'luas' }) as Parameters<typeof luasJourney>[0];
  const MIN = 60_000;

  it('adds the timetable\'s run times to its live time, stop by stop to its destination', () => {
    const journey = luasJourney(tram('Southbound', 'LU_BRI'), 'LU_RAN', NOW + 2 * MIN, NOW)!;
    expect(journey.estimated).toBe(true);
    expect(journey.stops[0]).toMatchObject({ code: 'LU_RAN', inMins: 2 });
    expect(journey.stops.at(-1)!.code).toBe('LU_BRI');
    expect(journey.stops.map((s) => s.code).slice(0, 3)).toEqual(['LU_RAN', 'LU_BEE', 'LU_COW']);
    // Later stops are later, about two minutes apart.
    const mins = journey.stops.map((s) => s.inMins);
    expect(mins.every((m, i) => i === 0 || m >= mins[i - 1]!)).toBe(true);
    expect(mins[1]! - mins[0]!).toBeGreaterThanOrEqual(1);
    expect(mins[1]! - mins[0]!).toBeLessThanOrEqual(3);
  });

  it('goes round the city-centre loop the way trams do', () => {
    const north = luasJourney(tram('Northbound', 'LU_BRO'), 'LU_DAW', NOW, NOW)!.stops.map((s) => s.code);
    expect(north.slice(0, 5)).toEqual(['LU_DAW', 'LU_WES', 'LU_OGP', 'LU_OUP', 'LU_DOM']);
    const south = luasJourney(tram('Southbound', 'LU_BRI'), 'LU_DOM', NOW, NOW)!.stops.map((s) => s.code);
    expect(south.slice(0, 5)).toEqual(['LU_DOM', 'LU_PAR', 'LU_MAR', 'LU_TRY', 'LU_DAW']);
    // "Parnell" trams turn from O'Connell – Upper into Parnell.
    expect(luasJourney(tram('Northbound', 'LU_PAR'), 'LU_WES', NOW, NOW)!.stops.map((s) => s.code)).toEqual(['LU_WES', 'LU_OGP', 'LU_OUP', 'LU_PAR']);
  });

  it('places it back along the track: at the stop when due, else just left the one before, or not yet set off', () => {
    expect(luasJourney(tram('Southbound', 'LU_BRI'), 'LU_RAN', NOW, NOW)!.now).toMatchObject({ kind: 'at', code: 'LU_RAN' });
    expect(luasJourney(tram('Southbound', 'LU_BRI'), 'LU_RAN', NOW + MIN, NOW)!.now).toMatchObject({ kind: 'left', code: 'LU_CHA' });
    expect(luasJourney(tram('Southbound', 'LU_BRI'), 'LU_RAN', NOW + 5 * MIN, NOW)!.now).toMatchObject({ kind: 'left', code: 'LU_STS' });
    // Due at Charlemont in an hour: further than the line goes back from there.
    expect(luasJourney(tram('Southbound', 'LU_BRI'), 'LU_CHA', NOW + 60 * MIN, NOW)!.now).toMatchObject({ kind: 'notStarted', code: 'LU_BRO' });
  });

  it('gives no estimate for a destination it can\'t reach this way', () => {
    expect(luasJourney(tram('Northbound', 'LU_BRI'), 'LU_RAN', NOW, NOW)).toBeUndefined();
    expect(luasJourney(tram('Southbound', 'LU_BRI'), 'LU_WES', NOW, NOW)).toBeUndefined();
  });
});
