/**
 * Translink NI Railways routes, for the Translink NIR service. There's no live data for NI Railways, so these
 * only drive the map and the station list. Each route's paths run from Belfast Grand Central outwards (the
 * Portrush branch from Coleraine), so with the line helpers "Northbound" means away from Belfast.
 *
 * Since Grand Central opened (2025) every line except Portadown/Newry leaves Belfast through City Hospital,
 * Botanic and Lanyon Place; Derry trains branch north after York Street and don't call at Whiteabbey.
 */
import type { Line } from './line';

export type NirRouteId = 'bangor' | 'larne' | 'derry' | 'portrush' | 'portadown';

export interface NirRoute {
  id: NirRouteId;
  line: Line;
}

const CROSS_CITY = ['BFSTC', 'NI_CITYH', 'NI_BOTAN', 'NI_LANYN'];

const route = (id: NirRouteId, paths: string[][]): NirRoute => ({
  id,
  line: { paths, termini: { Northbound: paths.map((p) => p.at(-1)!), Southbound: paths.map((p) => p[0]!) } },
});

export const NIR_ROUTES: NirRoute[] = [
  route('bangor', [
    [...CROSS_CITY, 'NI_TITQ', 'NI_SYDEN', 'NI_HWOOD', 'NI_MARIN', 'NI_CULTR', 'NI_SEAHL', 'NI_HELEN', 'NI_CARNL', 'NI_BANGW', 'NI_BANGR'],
  ]),
  route('larne', [
    [...CROSS_CITY, 'NI_YORKG', 'NI_WABBY', 'NI_JORDN', 'NI_GRNIS', 'NI_TROOP', 'NI_CLIPP', 'NI_CFERG', 'NI_DOWNS', 'NI_WHEAD', 'NI_BCARY', 'NI_MAGHM', 'NI_GLYNN', 'NI_LARNT', 'NI_LARNH'],
  ]),
  route('derry', [
    [...CROSS_CITY, 'NI_YORKG', 'NI_MOSSW', 'NI_ANTRM', 'NI_BMENA', 'NI_CULLY', 'NI_BMONY', 'NI_COLER', 'NI_CROCK', 'NI_BELLA', 'NI_DERRY'],
  ]),
  route('portrush', [['NI_COLER', 'NI_UNIV', 'NI_DHUVR', 'NI_PRUSH']]),
  route('portadown', [
    ['BFSTC', 'NI_ADELA', 'NI_BALMO', 'NI_FINAG', 'NI_DUNMU', 'NI_DERRI', 'NI_LAMBE', 'NI_HILDE', 'LBURN', 'MOIRA', 'LURGN', 'PDOWN', 'NI_SCARV', 'NI_POYNT', 'NEWRY'],
  ]),
];

/** Every NI Railways station, each once, in route order. */
export const NIR_STATION_CODES: string[] = [...new Set(NIR_ROUTES.flatMap((r) => r.line.paths.flat()))];

/** NI Railways stations with no live times at all (everything except where the Enterprise calls). */
export const hasLiveData = (code: string) => !code.startsWith('NI_') && !['LBURN', 'MOIRA', 'LURGN'].includes(code);
