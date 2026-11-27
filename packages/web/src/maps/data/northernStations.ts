import { SERVICES } from '@dart-times/core';
import type { NetworkStation } from './network.data';

/**
 * Northern Ireland Railways, hand-maintained for the all-stations map.
 *
 * Irish Rail's API only knows the Enterprise stations and a few others along the Belfast line, and the
 * generated network (network.data.ts) only links what Enterprise trains pass. So the NI track is drawn
 * from here instead, and any generated track between two NI stations is ignored. Stations Irish Rail
 * has no codes for get our own `NI_` codes; they have no live data and aren't tappable.
 *
 * Always "Derry", never the other name.
 */
const NEW_STATIONS: [code: string, name: string][] = [
  // Belfast–Portadown–Newry (Belfast here is BFSTC, Irish Rail's Enterprise terminus)
  ['NI_ADELA', 'Adelaide'],
  ['NI_BALMO', 'Balmoral'],
  ['NI_FINAG', 'Finaghy'],
  ['NI_DUNMU', 'Dunmurry'],
  ['NI_DERRI', 'Derriaghy'],
  ['NI_LAMBE', 'Lambeg'],
  ['NI_HILDE', 'Hilden'],
  ['NI_SCARV', 'Scarva'],
  ['NI_POYNT', 'Poyntzpass'],
  // Through Belfast (York Street replaced Yorkgate in 2025; the code is unchanged)
  ['NI_CITYH', 'City Hospital'],
  ['NI_BOTAN', 'Botanic'],
  ['NI_LANYN', 'Lanyon Place'],
  ['NI_YORKG', 'York Street'],
  ['NI_WABBY', 'Whiteabbey'],
  // Bangor line
  ['NI_TITQ', 'Titanic Quarter'],
  ['NI_SYDEN', 'Sydenham'],
  ['NI_HWOOD', 'Holywood'],
  ['NI_MARIN', 'Marino'],
  ['NI_CULTR', 'Cultra'],
  ['NI_SEAHL', 'Seahill'],
  ['NI_HELEN', "Helen's Bay"],
  ['NI_CARNL', 'Carnalea'],
  ['NI_BANGW', 'Bangor West'],
  ['NI_BANGR', 'Bangor'],
  // Larne line
  ['NI_JORDN', 'Jordanstown'],
  ['NI_GRNIS', 'Greenisland'],
  ['NI_TROOP', 'Trooperslane'],
  ['NI_CLIPP', 'Clipperstown'],
  ['NI_CFERG', 'Carrickfergus'],
  ['NI_DOWNS', 'Downshire'],
  ['NI_WHEAD', 'Whitehead'],
  ['NI_BCARY', 'Ballycarry'],
  ['NI_MAGHM', 'Magheramorne'],
  ['NI_GLYNN', 'Glynn'],
  ['NI_LARNT', 'Larne Town'],
  ['NI_LARNH', 'Larne Harbour'],
  // Derry line
  ['NI_MOSSW', 'Mossley West'],
  ['NI_ANTRM', 'Antrim'],
  ['NI_BMENA', 'Ballymena'],
  ['NI_CULLY', 'Cullybackey'],
  ['NI_BMONY', 'Ballymoney'],
  ['NI_COLER', 'Coleraine'],
  ['NI_CROCK', 'Castlerock'],
  ['NI_BELLA', 'Bellarena'],
  ['NI_DERRY', 'Derry'],
  // Portrush branch
  ['NI_UNIV', 'University'],
  ['NI_DHUVR', 'Dhu Varren'],
  ['NI_PRUSH', 'Portrush'],
];

/** Each line as a run of neighbouring stations. */
const LINES: string[][] = [
  ['NEWRY', 'NI_POYNT', 'NI_SCARV', 'PDOWN', 'LURGN', 'MOIRA', 'LBURN', 'NI_HILDE', 'NI_LAMBE', 'NI_DERRI', 'NI_DUNMU', 'NI_FINAG', 'NI_BALMO', 'NI_ADELA', 'BFSTC'],
  ['BFSTC', 'NI_CITYH', 'NI_BOTAN', 'NI_LANYN', 'NI_YORKG', 'NI_WABBY'],
  ['NI_LANYN', 'NI_TITQ', 'NI_SYDEN', 'NI_HWOOD', 'NI_MARIN', 'NI_CULTR', 'NI_SEAHL', 'NI_HELEN', 'NI_CARNL', 'NI_BANGW', 'NI_BANGR'],
  ['NI_WABBY', 'NI_JORDN', 'NI_GRNIS', 'NI_TROOP', 'NI_CLIPP', 'NI_CFERG', 'NI_DOWNS', 'NI_WHEAD', 'NI_BCARY', 'NI_MAGHM', 'NI_GLYNN', 'NI_LARNT', 'NI_LARNH'],
  ['NI_YORKG', 'NI_MOSSW', 'NI_ANTRM', 'NI_BMENA', 'NI_CULLY', 'NI_BMONY', 'NI_COLER', 'NI_CROCK', 'NI_BELLA', 'NI_DERRY'],
  ['NI_COLER', 'NI_UNIV', 'NI_DHUVR', 'NI_PRUSH'],
];

/** Irish Rail stations that are in Northern Ireland. */
const IRISH_RAIL_NI = ['NEWRY', 'PDOWN', 'LURGN', 'MOIRA', 'LBURN', 'BFSTC'];

export const NI_STATIONS: Pick<NetworkStation, 'code' | 'name'>[] = NEW_STATIONS.map(([code, name]) => ({ code, name }));

const NI_CODES = new Set([...IRISH_RAIL_NI, ...NEW_STATIONS.map(([code]) => code)]);
const NI_EDGES = LINES.flatMap((line) => line.slice(1).map((code, i): [string, string] => [line[i]!, code]));

/** The generated network with the NI track swapped for the hand-drawn one. */
export function withNorthernTrack(edges: [string, string][]): [string, string][] {
  return [...edges.filter(([a, b]) => !(NI_CODES.has(a) && NI_CODES.has(b))), ...NI_EDGES];
}

// Live data in NI comes only from Enterprise trains, so only the stations they call at have any.
const enterpriseStops = new Set(SERVICES.enterprise.stations.map((s) => s.code));

/** Whether a station is in Northern Ireland (any line, Enterprise or NI Railways). */
export const isNorthern = (code: string) => NI_CODES.has(code);

/** NI stations we have no live times for: shown in italics; tapping one says so. */
export const hasNoData = (code: string) => NI_CODES.has(code) && !enterpriseStops.has(code);
