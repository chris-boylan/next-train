// Luas (Dublin's trams) live forecasts, from TII's Luas Forecasting API. It's unofficial-feeling but public: no key,
// HTTPS works, no CORS (so, like Irish Rail's, it's only called from our API). Answers are XML served as text/html.
//   forecast: get.ashx?action=forecast&stop=RAN&encrypt=false — each direction's next trams (minutes, destination)
//   stops:    get.ashx?action=stops&encrypt=false — both lines' stops in order, with codes and coordinates
// There are no tram IDs, delays, scheduled times or positions. A direction with nothing to show holds one pseudo-tram
// with no minutes: "No Northbound Service" at a one-way stop in the city centre, or "See news for information"
// during a disruption (the stop's <message> then says what's wrong).
import { XMLParser } from 'fast-xml-parser';

export const LUAS_BASE_URL = 'https://luasforecasts.rpa.ie/xml/get.ashx';

export interface RawLuasTram {
  /** Minutes until it's due; "DUE" when it's arriving, "" on a pseudo-tram. */
  dueMins: string;
  destination: string;
}

export interface RawLuasForecast {
  /** The stop's name and code as the feed has them, e.g. "Ranelagh", "RAN". */
  stop: string;
  stopAbv: string;
  /** The line's status, e.g. "Green Line services operating normally". */
  message: string;
  inbound: RawLuasTram[];
  outbound: RawLuasTram[];
}

export interface RawLuasStop {
  /** The feed's code, e.g. "RAN". */
  abrev: string;
  name: string;
  lat: number;
  lon: number;
  line: 'red' | 'green';
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  isArray: (name) => ['direction', 'tram', 'line', 'stop'].includes(name),
  parseAttributeValue: false,
});

type Node = Record<string, unknown>;
const attr = (node: Node, key: string) => String(node[key] ?? '').trim();

/** One stop's forecast, from the feed's XML. */
export function parseLuasForecast(xml: string): RawLuasForecast {
  const info = (parser.parse(xml) as { stopInfo?: Node }).stopInfo;
  if (!info) throw new Error('Luas forecast: no stopInfo in the response');
  const directions = (info.direction as Node[] | undefined) ?? [];
  const trams = (name: string): RawLuasTram[] =>
    ((directions.find((d) => attr(d, 'name') === name)?.tram as Node[] | undefined) ?? []).map((t) => ({
      dueMins: attr(t, 'dueMins'),
      destination: attr(t, 'destination'),
    }));
  const message = info.message;
  return {
    stop: attr(info, 'stop'),
    stopAbv: attr(info, 'stopAbv'),
    message: typeof message === 'string' ? message.trim() : attr((message as Node) ?? {}, 'text'),
    inbound: trams('Inbound'),
    outbound: trams('Outbound'),
  };
}

/** Both lines' stops in line order, from the feed's stops list. */
export function parseLuasStops(xml: string): RawLuasStop[] {
  const lines = ((parser.parse(xml) as { stops?: { line?: Node[] } }).stops?.line ?? []) as Node[];
  return lines.flatMap((line) => {
    const which = /red/i.test(attr(line, 'name')) ? 'red' : 'green';
    return ((line.stop as Node[] | undefined) ?? []).map((s) => ({
      abrev: attr(s, 'abrev'),
      name: attr(s, 'text'),
      lat: Number(attr(s, 'lat')),
      lon: Number(attr(s, 'long')),
      line: which,
    }));
  });
}

export interface LuasClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** How long a stop's forecast is cached (the feed updates about every 30 s). */
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

/** Fetches Luas forecasts, caching each stop's for a little while so a busy page is one call to TII. */
export class LuasClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, { at: number; value: Promise<RawLuasForecast> }>();

  constructor(options: LuasClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? LUAS_BASE_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.ttlMs = options.ttlMs ?? 20_000;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  private async get(params: Record<string, string>): Promise<string> {
    const url = `${this.baseUrl}?${new URLSearchParams({ ...params, encrypt: 'false' })}`;
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Luas API ${params.action} returned HTTP ${res.status}`);
    return res.text();
  }

  /** A stop's forecast, by the feed's code (e.g. "RAN"). */
  getForecast(stopAbv: string): Promise<RawLuasForecast> {
    const key = stopAbv.toUpperCase();
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const value = this.get({ action: 'forecast', stop: key }).then(parseLuasForecast);
    // A failed answer isn't kept, so the next request tries again.
    value.catch(() => this.cache.delete(key));
    this.cache.set(key, { at: this.now(), value });
    return value;
  }

  async getStops(): Promise<RawLuasStop[]> {
    return parseLuasStops(await this.get({ action: 'stops' }));
  }
}
