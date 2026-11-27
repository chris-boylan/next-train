import { describe, expect, it } from 'vitest';
import { DEPARTED_PROGRESS, getLiveTrains, parsePublicMessage, placeTrain, SIGNAL_PROGRESS } from '../src/livetrains';
import type { RawTrainPosition } from '../src/irishRailClient';
import { fixtureClient } from './fixtures';

const raw = (message: string, overrides: Partial<RawTrainPosition> = {}): RawTrainPosition => ({
  TrainStatus: 'R',
  TrainLatitude: '0',
  TrainLongitude: '0',
  TrainCode: message.split('\\n')[0]!,
  TrainDate: '27 Nov 2026',
  PublicMessage: message,
  Direction: 'Northbound',
  ...overrides,
});

describe('parsePublicMessage', () => {
  it('reads a running train', () => {
    expect(parsePublicMessage('E934\\n16:01 - Greystones to Howth (1 mins late)\\nDeparted Killiney next stop Dalkey')).toEqual({
      code: 'E934',
      scheduledStart: '16:01',
      origin: 'Greystones',
      destination: 'Howth',
      lateMins: 1,
      state: 'departed',
      last: 'Killiney',
      next: 'Dalkey',
    });
  });

  it('reads early trains and the no-space form', () => {
    const msg = parsePublicMessage('E119\\n14:55 - Howth to Greystones(-2 mins late)\\nTERMINATED Greystones at 16:21');
    expect(msg).toMatchObject({ origin: 'Howth', destination: 'Greystones', lateMins: -2, state: 'terminated' });
  });

  it('reads trains not yet started', () => {
    const msg = parsePublicMessage('E833\\nGreystones to Malahide\\nExpected Departure 16:31');
    expect(msg).toMatchObject({ origin: 'Greystones', destination: 'Malahide', state: 'not-started' });
    expect(msg.lateMins).toBeUndefined();
  });

  it('keeps multi-word station names whole', () => {
    const msg = parsePublicMessage('E831\\n16:02 - Bray to Malahide (0 mins late)\\nArrived Dun Laoghaire next stop Salthill and Monkstown');
    expect(msg).toMatchObject({ state: 'arrived', last: 'Dun Laoghaire', next: 'Salthill and Monkstown' });
  });
});

describe('placeTrain', () => {
  it('stands an arrived train at its station', () => {
    const train = placeTrain(raw('E120\\n15:24 - Malahide to Greystones (2 mins late)\\nArrived Glenageary next stop Dalkey'));
    expect(train).toMatchObject({ at: 'GLGRY', to: 'DLKEY', direction: 'Southbound', lateMins: 2, destinationCode: 'GSTNS' });
    expect(train?.from).toBeUndefined();
  });

  it('puts a departed train between stations', () => {
    const train = placeTrain(raw('E933\\n15:55 - Bray to Howth (2 mins late)\\nDeparted Blackrock next stop Booterstown'));
    expect(train).toMatchObject({ from: 'BROCK', to: 'BTSTN', progress: DEPARTED_PROGRESS, direction: 'Northbound' });
  });

  it('works out direction on both northern branches', () => {
    const howth = placeTrain(raw('E931\\n15:03 - Greystones to Howth (5 mins late)\\nDeparted Howth Junction next stop Bayside'));
    expect(howth).toMatchObject({ from: 'HWTHJ', to: 'BYSDE', direction: 'Northbound' });
    const malahide = placeTrain(
      raw('E242\\n16:04 - Malahide to Bray (0 mins late)\\nDeparted Clongriffin next stop Howth Junction', { Direction: 'Northbound' }),
    );
    expect(malahide).toMatchObject({ from: 'GRGRD', to: 'HWTHJ', direction: 'Southbound' });
  });

  it('puts a train last seen at a signal just short of its next stop, on its own branch', () => {
    const train = placeTrain(
      raw('E242\\n16:04 - Malahide to Bray (0 mins late)\\nDeparted Howth Junction Signal HJ12 next stop Howth Junction', {
        Direction: 'Southbound',
      }),
    );
    expect(train).toMatchObject({ from: 'GRGRD', to: 'HWTHJ', progress: SIGNAL_PROGRESS, direction: 'Southbound' });
  });

  it('skips trains that are not running', () => {
    expect(placeTrain(raw('E833\\nGreystones to Malahide\\nExpected Departure 16:31', { TrainStatus: 'N' }))).toBeUndefined();
    expect(placeTrain(raw('E119\\n14:55 - Howth to Greystones(-2 mins late)\\nTERMINATED Greystones at 16:21', { TrainStatus: 'T' }))).toBeUndefined();
  });

  it('skips trains whose next stop is off the line', () => {
    expect(placeTrain(raw('D923\\n16:12 - Dublin Pearse to Maynooth (0 mins late)\\nDeparted Dublin Connolly next stop Drumcondra'))).toBeUndefined();
  });
});

describe('getLiveTrains', () => {
  it('places every running DART in a recorded feed', async () => {
    const trains = await getLiveTrains(fixtureClient('current-darts.xml'));
    // 22 trains: 5 not started, 3 terminated, 14 running.
    expect(trains).toHaveLength(14);
    expect(trains.find((t) => t.code === 'E121')).toMatchObject({ from: 'CTARF', to: 'CNLLY', direction: 'Southbound', lateMins: 1 });
    expect(trains.find((t) => t.code === 'E829')).toMatchObject({ at: 'CTARF', to: 'KLSTR', direction: 'Northbound', lateMins: 8 });
    expect(trains.find((t) => t.code === 'E932')).toMatchObject({ from: 'PERSE', to: 'TARA', direction: 'Northbound' });
  });
});

describe('getLiveTrains: Enterprise', () => {
  it('places only Belfast trains from the all-trains feed', async () => {
    const trains = await getLiveTrains(fixtureClient('current-trains.xml'), 'enterprise');
    expect(trains.map((t) => t.code).sort()).toEqual(['A118', 'A119', 'A120']);
    expect(trains.find((t) => t.code === 'A119')).toMatchObject({ from: 'DGHDA', to: 'CNLLY', direction: 'Southbound' });
    expect(trains.find((t) => t.code === 'A120')).toMatchObject({ from: 'DGHDA', to: 'DDALK', direction: 'Northbound' });
    expect(trains.find((t) => t.code === 'A118')).toMatchObject({ from: 'DDALK', to: 'NEWRY', destinationCode: 'BFSTC' });
  });

  it('leaves out commuter trains on the shared Connolly–Drogheda track', () => {
    const commuter = raw('D823\\n16:19 - Grand Canal Dock to Drogheda (0 mins late)\\nDeparted Dublin Connolly next stop Drogheda');
    expect(placeTrain(commuter, 'enterprise')).toBeUndefined();
  });
});

describe('placeTrain: Cork', () => {
  it('places a Midleton train on the harbour line, heading for Cork', () => {
    const train = placeTrain(raw('P571\\n16:45 - Midleton to Cork (1 mins late)\\nDeparted Carrigtwohill next stop Glounthaune'), 'cork');
    expect(train).toMatchObject({ from: 'CGTWL', to: 'GHANE', direction: 'Northbound', destinationCode: 'CORK', lateMins: 1 });
  });

  it('places a Cobh train on its own branch', () => {
    const train = placeTrain(raw('D528\\n17:00 - Cork to Cobh (0 mins late)\\nArrived Fota next stop Carrigaloe', { Direction: 'To Cobh' }), 'cork');
    expect(train).toMatchObject({ at: 'FOTA', to: 'CGLOE', direction: 'Southbound' });
  });

  it('leaves out InterCity trains between Cork and Mallow', () => {
    const intercity = raw('A223\\n16:25 - Cork to Dublin Heuston (2 mins late)\\nDeparted Cork next stop Mallow');
    expect(placeTrain(intercity, 'cork')).toBeUndefined();
    const mallow = raw('A308\\n15:25 - Mallow to Tralee (3 mins late)\\nDeparted Mallow next stop Banteer');
    expect(placeTrain(mallow, 'cork')).toBeUndefined();
  });
});
