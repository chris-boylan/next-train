import { describe, expect, it } from 'vitest';
import { DEPARTED_PROGRESS, getLiveTrains, parsePublicMessage, placeTrain, SIGNAL_PROGRESS } from '../src/livetrains';
import { IrishRailClient, type RawTrainPosition } from '../src/irishRailClient';
import { fixture, fixtureClient } from './fixtures';

/** A client answering the positions feed from one fixture and each station's board from `boards` (missing ones fail). */
function routedClient(feed: string, boards: Record<string, string> = {}, edit: (xml: string) => string = (x) => x) {
  return new IrishRailClient({
    fetch: async (url) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith('getStationDataByCodeXML_WithNumMins')) {
        const file = boards[u.searchParams.get('StationCode') ?? ''];
        return file ? new Response(fixture(file)) : new Response('', { status: 500 });
      }
      return new Response(edit(fixture(feed)));
    },
  });
}

const ENTERPRISE_BOARDS = Object.fromEntries(
  ['CNLLY', 'DGHDA', 'DDALK', 'NEWRY', 'PDOWN', 'BFSTC'].map((c) => [c, `enterprise-evening/${c}.xml`]),
);

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
    // No boards (they fail to load), so nothing is dropped or estimated: just the positions feed.
    const trains = await getLiveTrains(routedClient('current-trains.xml'), 'enterprise');
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

describe('placeTrain: stations passed without stopping', () => {
  it('puts an Enterprise just past Raheny near Connolly, not near Drogheda', () => {
    const train = placeTrain(raw('A124\\n17:50 - Dublin Connolly to Belfast (10 mins late)\\nDeparted Raheny next stop Drogheda'), 'enterprise');
    expect(train).toMatchObject({ from: 'CNLLY', to: 'DGHDA', direction: 'Northbound' });
    expect(train!.progress).toBeLessThan(0.25);
  });

  it('puts one past Portmarnock most of the way to Connolly', () => {
    const train = placeTrain(raw('A121\\n16:00 - Belfast to Dublin Connolly (8 mins late)\\nDeparted Portmarnock next stop Dublin Connolly'), 'enterprise');
    expect(train).toMatchObject({ from: 'DGHDA', to: 'CNLLY', direction: 'Southbound' });
    expect(train!.progress).toBeGreaterThan(0.6);
  });

  it('still draws a train at a signal just short of its next stop', () => {
    const train = placeTrain(raw('A124\\n17:50 - Dublin Connolly to Belfast (0 mins late)\\nDeparted North Strand Junction next stop Drogheda'), 'enterprise');
    expect(train?.progress).toBe(SIGNAL_PROGRESS);
  });
});

describe('getLiveTrains: Enterprise, checked against the station boards', () => {
  it('adds a train running untracked in Northern Ireland, estimated from its times', async () => {
    // 18:13: A125 left Belfast at 18:00 and is due at Portadown in 20 minutes, but isn't in the positions feed.
    const trains = await getLiveTrains(routedClient('enterprise-evening/current-trains.xml', ENTERPRISE_BOARDS), 'enterprise');
    const a125 = trains.find((t) => t.code === 'A125');
    expect(a125).toMatchObject({ from: 'BFSTC', to: 'PDOWN', direction: 'Southbound', estimated: true, lateMins: 0 });
    expect(a125!.progress).toBeGreaterThan(0.05);
    expect(a125!.progress).toBeLessThan(0.95);
    // Tracked trains stay as they are, and trains not yet started (A126, A127) aren't drawn.
    expect(trains.find((t) => t.code === 'A122')).toMatchObject({ from: 'DDALK', to: 'NEWRY' });
    expect(trains.find((t) => t.code === 'A122')!.estimated).toBeUndefined();
    expect(trains.map((t) => t.code)).not.toContain('A126');
    expect(trains.map((t) => t.code)).not.toContain('A127');
  });

  it('drops a position frozen at the border: a train its next stop no longer expects', async () => {
    // As A120 was at 18:09, two hours after it should have reached Belfast.
    const phantom = `<objTrainPositions><TrainStatus>R</TrainStatus><TrainLatitude>0</TrainLatitude><TrainLongitude>0</TrainLongitude><TrainCode>A120</TrainCode><TrainDate>27 Nov 2026</TrainDate><PublicMessage>A120\\n15:50 - Dublin Connolly to Belfast (1 mins late)\\nDeparted Dundalk next stop Newry</PublicMessage><Direction>Northbound</Direction></objTrainPositions>`;
    const client = routedClient('enterprise-evening/current-trains.xml', ENTERPRISE_BOARDS, (xml) => xml.replace('</ArrayOfObjTrainPositions>', `${phantom}</ArrayOfObjTrainPositions>`));
    const codes = (await getLiveTrains(client, 'enterprise')).map((t) => t.code);
    expect(codes).not.toContain('A120');
    expect(codes).toContain('A122');
  });
});

describe('getLiveTrains: Dublin Commuter and InterCity', () => {
  // Recorded at 19:55 on 27 Nov: 19 Commuter and 26 InterCity trains running.
  const client = () => routedClient('current-trains-evening.xml');

  it('places nearly every running Commuter train on its routes, and no DART or InterCity ones', async () => {
    const trains = await getLiveTrains(client(), 'commuter');
    expect(trains.length).toBeGreaterThanOrEqual(18);
    expect(trains.every((t) => !t.code.startsWith('E') && !t.code.startsWith('A'))).toBe(true);
  });

  it('places nearly every running InterCity train, the Enterprise left out', async () => {
    const trains = await getLiveTrains(client(), 'intercity');
    expect(trains.length).toBeGreaterThanOrEqual(25);
    expect(trains.every((t) => t.code.startsWith('A') && t.destination !== 'Belfast' && t.origin !== 'Belfast')).toBe(true);
  });
});
