import { describe, expect, it } from 'vitest';
import { adjacentStations, directionBetween } from '../src/line';
import { LUAS_GREEN_LINE, LUAS_LINE, LUAS_RED_LINE, LUAS_STATION_CODES, toLuasDepartures } from '../src/luas';
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
    // Northbound by Westmoreland and O'Connell; southbound by Parnell, Marlborough and Trinity.
    expect(adjacentStations('LU_WES', LUAS_LINE)).toEqual({ north: ['LU_OGP'], south: ['LU_DAW'] });
    expect(adjacentStations('LU_MAR', LUAS_LINE)).toEqual({ north: ['LU_PAR'], south: ['LU_TRY'] });
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
