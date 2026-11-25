import { readFileSync } from 'node:fs';
import { IrishRailClient } from '../src/irishRailClient';

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

/** A client whose station-data requests are answered from a fixture file. */
export function fixtureClient(name: string): IrishRailClient {
  const xml = fixture(name);
  return new IrishRailClient({ fetch: async () => new Response(xml) });
}
