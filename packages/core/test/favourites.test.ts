import { describe, expect, it } from 'vitest';
import { ALL_STATIONS, DART_STATIONS, describeDeparture, FavouriteError, FavouritesService, InMemoryFavouritesRepository, joinList, MAX_FAVOURITES } from '../src';

describe('FavouritesService', () => {
  const service = () => new FavouritesService(new InMemoryFavouritesRepository());

  it('adds, lists in order and removes', async () => {
    const favs = service();
    await favs.add('u1', 'PERSE');
    await favs.add('u1', 'cnlly');
    await favs.add('u1', 'PERSE');
    expect((await favs.list('u1')).map((s) => s.code)).toEqual(['PERSE', 'CNLLY']);
    expect(await favs.remove('u1', 'PERSE')).toBe(true);
    expect(await favs.remove('u1', 'PERSE')).toBe(false);
    expect((await favs.list('u1')).map((s) => s.code)).toEqual(['CNLLY']);
  });

  it('keeps users separate', async () => {
    const favs = service();
    await favs.add('u1', 'BRAY');
    expect(await favs.list('u2')).toEqual([]);
  });

  it('rejects unknown stations', async () => {
    await expect(service().add('u1', 'NOPE')).rejects.toMatchObject({ reason: 'UNKNOWN_STATION' });
  });

  it('is DART-only by default (Alexa) but takes any service\'s stations when given them (web)', async () => {
    await expect(service().add('u1', 'GALWY')).rejects.toMatchObject({ reason: 'UNKNOWN_STATION' });
    const web = new FavouritesService(new InMemoryFavouritesRepository(), ALL_STATIONS);
    await web.add('u1', 'GALWY');
    await web.add('u1', 'CORK');
    expect((await web.list('u1')).map((s) => s.code)).toEqual(['GALWY', 'CORK']);
  });

  it('enforces the limit', async () => {
    const favs = service();
    for (const s of DART_STATIONS.slice(0, MAX_FAVOURITES)) await favs.add('u1', s.code);
    await expect(favs.add('u1', DART_STATIONS[MAX_FAVOURITES]!.code)).rejects.toBeInstanceOf(FavouriteError);
  });
});

describe('describe helpers', () => {
  const base = {
    trainCode: 'E1', origin: 'Bray', destination: 'Howth', direction: 'Northbound',
    expectedDepart: '13:13', scheduledDepart: '13:13', trainType: 'DART', category: 'dart' as const, lastLocation: '',
  };

  it('describes on-time and late departures', () => {
    expect(describeDeparture({ ...base, dueInMins: 0, lateMins: 0 })).toBe('to Howth due now');
    expect(describeDeparture({ ...base, dueInMins: 1, lateMins: 32 })).toBe('to Howth in 1 minute, running 32 minutes late');
  });

  it('joins lists naturally', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
