import { DART_STATIONS, findStationByCode } from './stations';
import type { Station } from './types';

export const MAX_FAVOURITES = 10;

/** Storage for favourite station codes, oldest first. Each app supplies its own adapter. */
export interface FavouritesRepository {
  list(userId: string): Promise<string[]>;
  add(userId: string, stationCode: string): Promise<void>;
  remove(userId: string, stationCode: string): Promise<void>;
}

export class FavouriteError extends Error {
  constructor(
    readonly reason: 'UNKNOWN_STATION' | 'LIMIT_REACHED',
    message: string,
  ) {
    super(message);
    this.name = 'FavouriteError';
  }
}

export class FavouritesService {
  constructor(
    private readonly repo: FavouritesRepository,
    private readonly stations: Station[] = DART_STATIONS,
  ) {}

  async list(userId: string): Promise<Station[]> {
    const codes = await this.repo.list(userId);
    return codes.flatMap((code) => findStationByCode(code, this.stations) ?? []);
  }

  async add(userId: string, stationCode: string): Promise<Station> {
    const station = findStationByCode(stationCode, this.stations);
    if (!station) throw new FavouriteError('UNKNOWN_STATION', `Unknown DART station: ${stationCode}`);
    const existing = await this.repo.list(userId);
    if (existing.includes(station.code)) return station;
    if (existing.length >= MAX_FAVOURITES) {
      throw new FavouriteError('LIMIT_REACHED', `You can save up to ${MAX_FAVOURITES} favourite stations`);
    }
    await this.repo.add(userId, station.code);
    return station;
  }

  /** Returns whether the station was a favourite. */
  async remove(userId: string, stationCode: string): Promise<boolean> {
    const code = stationCode.trim().toUpperCase();
    const existing = await this.repo.list(userId);
    if (!existing.includes(code)) return false;
    await this.repo.remove(userId, code);
    return true;
  }
}

/** For tests and local development. */
export class InMemoryFavouritesRepository implements FavouritesRepository {
  private readonly store = new Map<string, string[]>();

  async list(userId: string): Promise<string[]> {
    return [...(this.store.get(userId) ?? [])];
  }

  async add(userId: string, stationCode: string): Promise<void> {
    const codes = this.store.get(userId) ?? [];
    if (!codes.includes(stationCode)) this.store.set(userId, [...codes, stationCode]);
  }

  async remove(userId: string, stationCode: string): Promise<void> {
    this.store.set(
      userId,
      (this.store.get(userId) ?? []).filter((c) => c !== stationCode),
    );
  }
}
