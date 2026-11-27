import { describe, expect, it } from 'vitest';
import {
  parseStationData,
  placeDeparture,
  placeTimetabled,
  type ScheduledDeparture,
  SERVICES,
  stationLines,
  terminiFrom,
  toDepartures,
} from '../src';
import { fixture } from './fixtures';

const commuter = SERVICES.commuter;

describe('stationLines', () => {
  it('gives a Commuter hub one line per route, in route order', () => {
    expect(stationLines(commuter, 'CNLLY').map((l) => l.id)).toEqual(['northern', 'western', 'southWestern', 'southEastern']);
    expect(stationLines(commuter, 'DCDRA').map((l) => l.id)).toEqual(['western', 'southWestern']);
  });

  it('gives other stations their one line', () => {
    expect(stationLines(commuter, 'MYNTH').map((l) => l.id)).toEqual(['western']);
    expect(stationLines(SERVICES.dart, 'BRAY')).toEqual([{ id: 'main', line: SERVICES.dart.line }]);
  });
});

describe('placeDeparture', () => {
  // Real trains recorded from the API: each must land on one of the station's lines by its actual route,
  // not by the fallback (which only exists so that no train can ever drop off the page).
  it.each([
    ['commuter', 'CNLLY', 'connolly-midday.xml'],
    ['intercity', 'HSTON', 'heuston-midday.xml'],
    ['intercity', 'LMRKJ', 'limerick-junction-midday.xml'],
    ['intercity', 'CNLLY', 'connolly-midday.xml'],
  ] as const)('places every %s train at %s (%s) on its route', (serviceId, code, file) => {
    const service = SERVICES[serviceId];
    const departures = toDepartures(parseStationData(fixture(file)), { service: serviceId });
    const lines = stationLines(service, code);
    expect(departures.length).toBeGreaterThan(0);
    for (const d of departures) {
      const p = placeDeparture(service, code, lines, d);
      expect(p, `${d.trainCode} to ${d.destination}`).toBeDefined();
      expect(lines.map((l) => l.id)).toContain(p!.lineId);
      expect(p!.fallback, `${d.trainCode} ${d.origin} to ${d.destination}`).toBeUndefined();
    }
  });

  it('names each end of a line once', () => {
    const corkKerry = stationLines(SERVICES.intercity, 'KDARE')[0]!.line;
    expect(terminiFrom('KDARE', 'Southbound', corkKerry)).toEqual(['HSTON']);
    expect(terminiFrom('KDARE', 'Northbound', corkKerry)).toEqual(['CORK', 'TRLEE']);
  });

  it('gives InterCity stations one line per route', () => {
    expect(stationLines(SERVICES.intercity, 'KDARE').map((l) => l.id)).toEqual(['corkKerry', 'galwayMayo', 'limerick', 'waterford']);
    expect(stationLines(SERVICES.intercity, 'LMRKJ').map((l) => l.id)).toEqual(['corkKerry', 'limerick', 'waterford']);
    expect(stationLines(SERVICES.intercity, 'WPORT').map((l) => l.id)).toEqual(['galwayMayo']);
  });

  it('places Commuter trains on their route, outbound as Northbound', () => {
    const lines = stationLines(commuter, 'CNLLY');
    const dep = (originCode: string, destinationCode: string) =>
      ({ trainCode: 'P1', originCode, destinationCode, direction: 'Northbound' }) as Parameters<typeof placeDeparture>[3];
    expect(placeDeparture(commuter, 'CNLLY', lines, dep('CNLLY', 'MYNTH'))).toEqual({ lineId: 'western', direction: 'Northbound' });
    expect(placeDeparture(commuter, 'CNLLY', lines, dep('DDALK', 'GCDK'))).toEqual({ lineId: 'northern', direction: 'Southbound' });
    expect(placeDeparture(commuter, 'CNLLY', lines, dep('CNLLY', 'GOREY'))).toEqual({ lineId: 'southEastern', direction: 'Northbound' });
  });

  it('puts a train through the city to another route on the inbound track (Maynooth to Dun Laoghaire)', () => {
    const lines = stationLines(commuter, 'MYNTH');
    const dep = { trainCode: 'P2', originCode: 'MYNTH', destinationCode: 'DLERY', direction: 'Southbound' } as Parameters<typeof placeDeparture>[3];
    expect(placeDeparture(commuter, 'MYNTH', lines, dep)).toEqual({ lineId: 'western', direction: 'Southbound', fallback: true });
  });

  it('still places a train whose route can’t be told, on the first line', () => {
    const lines = stationLines(commuter, 'CNLLY');
    const odd = { trainCode: 'P9', destination: 'Longford', direction: 'To Longford' } as Parameters<typeof placeDeparture>[3];
    expect(placeDeparture(commuter, 'CNLLY', lines, odd)).toEqual({ lineId: 'northern', direction: 'Northbound', fallback: true });
  });
});

describe('placeTimetabled', () => {
  const sched = (destinationCode: string, category: ScheduledDeparture['category'] = 'commuter'): ScheduledDeparture => ({
    time: '15:00', minutes: 900, trainCode: 'P1', destinationCode, destination: '', category,
  });

  it('places the service’s own timetabled trains, and skips others', () => {
    const lines = stationLines(commuter, 'CNLLY');
    expect(placeTimetabled(commuter, 'CNLLY', lines, sched('M3WAY'))).toEqual({ lineId: 'western', direction: 'Northbound' });
    expect(placeTimetabled(commuter, 'CNLLY', lines, sched('BRAY', 'dart'))).toBeUndefined();
  });

  it('lists the Enterprise on NI Railways pages', () => {
    const nir = SERVICES.nir;
    const lines = stationLines(nir, 'PDOWN');
    expect(placeTimetabled(nir, 'PDOWN', lines, sched('BFSTC', 'enterprise'))).toEqual({ lineId: 'main', direction: 'Northbound' });
    expect(placeTimetabled(nir, 'PDOWN', lines, sched('NEWRY', 'nir'))).toEqual({ lineId: 'main', direction: 'Southbound' });
  });
});
