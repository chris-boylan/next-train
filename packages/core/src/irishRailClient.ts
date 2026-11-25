import { XMLParser } from 'fast-xml-parser';

// The HTTPS endpoint returns 500, so plain HTTP is the only option.
export const IRISH_RAIL_BASE_URL = 'http://api.irishrail.ie/realtime/realtime.asmx';

export interface RawStation {
  StationDesc: string;
  StationAlias: string;
  StationCode: string;
  StationLatitude: string;
  StationLongitude: string;
}

export interface RawStationData {
  Traincode: string;
  Stationfullname: string;
  Stationcode: string;
  Origin: string;
  Destination: string;
  Status: string;
  Lastlocation: string;
  Duein: string;
  Late: string;
  Exparrival: string;
  Expdepart: string;
  Scharrival: string;
  Schdepart: string;
  Direction: string;
  Traintype: string;
  /** O = origin, S = stop, D = destination (terminates here), T = timing point. */
  Locationtype: string;
}

export interface RawTrainPosition {
  TrainStatus: string;
  TrainCode: string;
  TrainDate: string;
  /** e.g. `E117\n13:55 - Howth to Greystones (12 mins late)\nArrived Woodbrook next stop Bray` */
  PublicMessage: string;
  Direction: string;
}

export interface RawTrainMovement {
  TrainCode: string;
  TrainDate: string;
  LocationCode: string;
  LocationFullName: string;
  LocationOrder: string;
  /** O = origin, S = stop, D = destination, T = timing point (not a stop), C = cancelled stop. */
  LocationType: string;
  TrainOrigin: string;
  TrainDestination: string;
  ScheduledDeparture: string;
  ExpectedDeparture: string;
  Arrival: string;
  Departure: string;
}

export interface IrishRailClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** How long live departure data is cached. */
  departuresTtlMs?: number;
  /** Per-request timeout. Alexa gives a skill 8 seconds in total, so keep this well under. */
  timeoutMs?: number;
  now?: () => number;
}

const parser = new XMLParser({
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ['objStation', 'objStationData', 'objTrainPositions', 'objTrainMovements'].includes(name),
});

export function parseStations(xml: string): RawStation[] {
  const root = parser.parse(xml)?.ArrayOfObjStation;
  return root?.objStation ?? [];
}

export function parseStationData(xml: string): RawStationData[] {
  const root = parser.parse(xml)?.ArrayOfObjStationData;
  return root?.objStationData ?? [];
}

export function parseTrainPositions(xml: string): RawTrainPosition[] {
  const root = parser.parse(xml)?.ArrayOfObjTrainPositions;
  return root?.objTrainPositions ?? [];
}

export function parseTrainMovements(xml: string): RawTrainMovement[] {
  const root = parser.parse(xml)?.ArrayOfObjTrainMovements;
  return root?.objTrainMovements ?? [];
}

/** The API's date format, e.g. `25 Nov 2026`. */
export function formatTrainDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Dublin' });
}

export class IrishRailClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly departuresTtlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, { expires: number; value: Promise<string> }>();

  constructor(options: IrishRailClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? IRISH_RAIL_BASE_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.departuresTtlMs = options.departuresTtlMs ?? 30_000;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  async getDartStations(): Promise<RawStation[]> {
    const xml = await this.get('getAllStationsXML_WithStationType', { StationType: 'D' }, 24 * 60 * 60_000);
    return parseStations(xml);
  }

  /** All trains (DART and mainline) due at a station within `numMins` (5–90). */
  async getStationData(stationCode: string, numMins = 90): Promise<RawStationData[]> {
    const mins = Math.min(90, Math.max(5, Math.round(numMins)));
    const xml = await this.get(
      'getStationDataByCodeXML_WithNumMins',
      { StationCode: stationCode, NumMins: String(mins) },
      this.departuresTtlMs,
    );
    return parseStationData(xml);
  }

  /** DARTs currently running or due to start soon. */
  async getCurrentDarts(): Promise<RawTrainPosition[]> {
    const xml = await this.get('getCurrentTrainsXML_WithTrainType', { TrainType: 'D' }, this.departuresTtlMs);
    return parseTrainPositions(xml);
  }

  /** Every location on a train's run, in order, including timing points and cancelled stops. */
  async getTrainMovements(trainCode: string, date: Date = new Date(this.now())): Promise<RawTrainMovement[]> {
    const xml = await this.get(
      'getTrainMovementsXML',
      { TrainId: trainCode.trim(), TrainDate: formatTrainDate(date) },
      this.departuresTtlMs,
    );
    return parseTrainMovements(xml);
  }

  private get(endpoint: string, params: Record<string, string>, ttlMs: number): Promise<string> {
    const url = `${this.baseUrl}/${endpoint}?${new URLSearchParams(params)}`;
    const cached = this.cache.get(url);
    if (cached && cached.expires > this.now()) return cached.value;

    const value = this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) }).then(async (res) => {
      if (!res.ok) throw new Error(`Irish Rail API ${endpoint} returned HTTP ${res.status}`);
      return res.text();
    });
    this.cache.set(url, { expires: this.now() + ttlMs, value });
    value.catch(() => this.cache.delete(url));
    return value;
  }
}
