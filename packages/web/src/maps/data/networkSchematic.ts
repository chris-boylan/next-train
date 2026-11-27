/**
 * Geography-inspired layout for the all-stations map: every line in roughly the right place, with north
 * up, stretched tall so every name fits a phone's width.
 *
 * The map has four lanes across the screen (X0 … X3), and each line keeps its names to one side.
 * Junctions and ends of lines are placed by hand, and the stations between them are spaced along each
 * line, so mostly only the shape of each line is written down here.
 *
 *   - North: the Derry, Larne and Bangor lines fan out above Belfast; the Enterprise and Northern line run
 *     down the east lane (X3) to Dublin.
 *   - North-west: the Sligo line climbs from Dublin (WEST_X), with Mayo to its west: Ballina north of
 *     Manulla Junction, Westport south-west and the line to Athlone south, dropping to the west edge.
 *   - Dublin: Connolly on the coast; Drumcondra and Broombridge on a 45° line into the Western line;
 *     M3 Parkway off Clonsilla; Heuston and the Phoenix Park tunnel meeting at Park West.
 *   - South: the south-east coast down X3; the main line to Kildare (X2), then via Portarlington (X1)
 *     to Cork; the Waterford line straight down from Kildare; Athlone and Galway west of Dublin, and
 *     Limerick, Ennis and Tralee west of the main line.
 *
 * Distances aren't to scale: stations are evenly spaced, and busy areas get more room.
 */
import type { LabelPlacement, Schematic, SchematicPoint } from './schematics';

type Point = [number, number];

const X0 = 8;
const X1 = 90;
const X2 = 164;
const X3 = 250;
/** The Western and Sligo line, between X1 and X2. */
const WEST_X = 136;
/** Mayo's line, just west of the Sligo line, its names on the left. */
const MAYO_X = 108;
const ROW = 32;

/**
 * The Nenagh line's far end, drawn as its own stop below the line: it's Ballybrophy on the main line, but
 * drawing the track back up to it would cross the main line. NetworkMap names it and opens Ballybrophy.
 */
export const NENAGH_END = 'NENAGH_BBRHY';

/**
 * Irish names are longer and wrap onto more lines, so the Irish map is stretched taller (its diagonals
 * get steeper; nothing moves sideways), and the Waterford line sits a little further west to fit
 * "Cill Chainnigh", where in English it makes room for "Templemore" beside it.
 */
export function networkSchematic(lang: 'en' | 'ga' = 'en'): Schematic {
  const stretch = lang === 'ga' ? 1.5 : 1;
  const points: Record<string, SchematicPoint> = {};
  const bends: Record<string, Point[]> = {};

  const stop = (code: string, [x, y]: Point, label: LabelPlacement = 'right', extra: Partial<SchematicPoint> = {}) => {
    points[code] = { x, y, label, ...extra };
  };
  const at = (code: string): Point => {
    const p = points[code];
    if (!p) throw new Error(`networkSchematic: ${code} isn't placed yet`);
    return [p.x, p.y];
  };
  const bend = (from: string, to: string, ...corners: Point[]) => {
    bends[`${from}|${to}`] = corners;
  };
  /** A vertical run of stations `row` apart, upwards (step -1) or downwards (step 1). */
  const column = (codes: string[], x: number, y: number, step: 1 | -1, label: LabelPlacement = 'right', row = ROW) =>
    codes.forEach((code, i) => stop(code, [x, y + step * row * i], label));
  /** Stations evenly spaced on a straight line between two placed (or given) points, ends excluded. */
  const between = (codes: string[], from: Point, to: Point, label: LabelPlacement = 'right') =>
    codes.forEach((code, i) => {
      const t = (i + 1) / (codes.length + 1);
      stop(code, [Math.round(from[0] + (to[0] - from[0]) * t), Math.round(from[1] + (to[1] - from[1]) * t)], label);
    });

  // ---------- Northern Ireland ----------
  // Belfast Grand Central, City Hospital, Botanic and Lanyon Place up the east lane (every line but
  // Portadown's leaves Belfast this way), with Bangor straight on up it. York Street leads north-west to
  // Whiteabbey, where Larne heads up X2 (names on the left, clear of the Bangor line); the Derry line
  // branches west at York Street (its trains don't call at Whiteabbey), then climbs X0 to Coleraine.
  const lanyonY = 640;
  stop('NI_LANYN', [X3, lanyonY]);
  stop('NI_BOTAN', [X3, lanyonY + ROW]);
  stop('NI_CITYH', [X3, lanyonY + 2 * ROW]);
  stop('BFSTC', [X3, lanyonY + 3 * ROW]);
  column(['NI_TITQ', 'NI_SYDEN', 'NI_HWOOD', 'NI_MARIN', 'NI_CULTR', 'NI_SEAHL', 'NI_HELEN', 'NI_CARNL', 'NI_BANGW', 'NI_BANGR'], X3, lanyonY - ROW, -1);
  const whiteabbey: Point = [X2, lanyonY - (X3 - X2)];
  stop('NI_WABBY', whiteabbey, 'left');
  between(['NI_YORKG'], at('NI_LANYN'), whiteabbey, 'left');
  column(['NI_JORDN', 'NI_GRNIS', 'NI_TROOP', 'NI_CLIPP', 'NI_CFERG', 'NI_DOWNS', 'NI_WHEAD', 'NI_BCARY', 'NI_MAGHM', 'NI_GLYNN', 'NI_LARNT', 'NI_LARNH'], X2, whiteabbey[1] - ROW, -1, 'left');
  const coleraineY = 150;
  // The Derry line leaves York Street heading west, then climbs X0.
  const derryJunctionY = at('NI_YORKG')[1];
  column(['NI_MOSSW', 'NI_ANTRM', 'NI_BMENA', 'NI_CULLY', 'NI_BMONY'], X0, derryJunctionY - 40, -1, 'right', (derryJunctionY - 40 - coleraineY) / 5);
  bend('NI_YORKG', 'NI_MOSSW', [X0, derryJunctionY]);
  // York Street's name sits under the Derry line leaving it; Ballymena and Carrickfergus share a row, so their
  // names step apart.
  points['NI_YORKG'] = { ...points['NI_YORKG']!, label: 'below', labelDx: -20 };
  points['NI_BMENA'] = { ...points['NI_BMENA']!, labelDy: -10 };
  points['NI_CFERG'] = { ...points['NI_CFERG']!, labelDy: 8 };
  stop('NI_COLER', [X0, coleraineY], 'below', { labelDx: 32, labelDy: -12 });
  column(['NI_CROCK', 'NI_BELLA', 'NI_DERRY'], X0, coleraineY - ROW, -1);
  // Portrush: east along the coast from Coleraine, then north.
  column(['NI_UNIV', 'NI_DHUVR', 'NI_PRUSH'], X1, coleraineY - ROW, -1);
  bend('NI_COLER', 'NI_UNIV', [X1, coleraineY]);

  // ---------- Enterprise and Northern line, down the east lane ----------
  column(['NI_ADELA', 'NI_BALMO', 'NI_FINAG', 'NI_DUNMU', 'NI_DERRI', 'NI_LAMBE', 'NI_HILDE', 'LBURN', 'MOIRA', 'LURGN', 'PDOWN', 'NI_SCARV', 'NI_POYNT', 'NEWRY', 'DDALK', 'DGHDA', 'LTOWN', 'GSTON', 'BBRGN', 'SKRES', 'RLUSK', 'DBATE', 'MHIDE', 'PMNCK', 'GRGRD'], X3, at('BFSTC')[1] + ROW, 1);
  // The Howth branch leaves Howth Junction itself at 45° (the dot sits on the split), then runs north beside
  // the main line with its names on the right, like M3 Parkway from Clonsilla. Room above Howth Junction for it.
  const howthJn: Point = [X3, at('GRGRD')[1] + 5 * ROW];
  const howthX = X3 + 32;
  stop('HWTHJ', howthJn, 'right', { labelDy: 6 });
  column(['BYSDE', 'SUTTN', 'HOWTH'], howthX, howthJn[1] - (howthX - X3) - 24, -1);
  bend('HWTHJ', 'BYSDE', [howthX, howthJn[1] - (howthX - X3)]);
  // Howth Junction's name sits beside it now, so the line carries on south a row later (two in Irish, whose name
  // wraps onto more lines); Dublin stays where it was before the branch got its own column.
  column(['KBRCK', 'RAHNY', 'HTOWN', 'KLSTR', 'CTARF', 'CNLLY'], X3, howthJn[1] + (lang === 'ga' ? 2 : 1) * ROW, 1);
  const connollyY = at('CNLLY')[1];

  // ---------- South-east coast ----------
  column(['TARA', 'PERSE', 'GCDK', 'LDWNE', 'SMONT', 'SIDNY', 'BTSTN', 'BROCK', 'SEAPT', 'SHILL', 'DLERY', 'SCOVE', 'GLGRY', 'DLKEY', 'KILNY', 'SKILL', 'WBROK', 'BRAY', 'GSTNS', 'KCOOL', 'WLOW', 'RDRUM', 'ARKLW', 'GOREY', 'ECRTY', 'WXFRD', 'RLSTD', 'RLEPT'], X3, connollyY + ROW, 1);

  // ---------- Dublin: Western line, Docklands, M3 ----------
  const westCorner: Point = [WEST_X, connollyY - (X3 - WEST_X)];
  // A little further out, clear of the lines either side of the station.
  stop('DCDRA', [X3 - 40, connollyY - 40], 'left', { labelDx: -6, labelDy: 4 });
  stop('BBRDG', [X3 - 86, connollyY - 86], 'left');
  stop('DCKLS', [X3 - 44, connollyY - 124], 'above');
  const westernTop = westCorner[1] - 72;
  column(['PELTN', 'ASHTN', 'PHNPK', 'CNOCK', 'CMINE', 'CLSLA', 'LXCON', 'LXLSA', 'MYNTH', 'KCOCK', 'ENFLD', 'MLGAR'], WEST_X, westernTop, -1);
  bend('BBRDG', 'PELTN', westCorner);
  // M3 Parkway peels off right of Clonsilla; the Maynooth line's names beside it sit on the left.
  const clonsilla = at('CLSLA');
  const m3X = WEST_X + 26;
  column(['HAFLD', 'DBYNE', 'M3WAY'], m3X, clonsilla[1] - 48, -1);
  bend('CLSLA', 'HAFLD', [m3X, clonsilla[1] - 32]);
  for (const code of ['LXCON', 'LXLSA', 'MYNTH', 'KCOCK']) points[code]!.label = 'left';
  // North of Mullingar the Sligo line's stations spread out, so Sligo sits north of the Mayo towns.
  column(['ETOWN', 'LFORD', 'DRMOD', 'CKOSH', 'BOYLE', 'BMOTE', 'COLNY', 'SLIGO'], WEST_X, at('MLGAR')[1] - 56, -1, 'right', 56);

  // ---------- Mayo ----------
  // Manulla Junction: Ballina north, Westport south-west, and the line to Athlone south. That line then
  // drops to the west edge above Dublin's western suburbs and runs down it to Athlone.
  const manulla: Point = [MAYO_X, 1024];
  stop('MNLAJ', manulla, 'left', { labelDy: -10 });
  column(['FXFRD', 'BALNA'], MAYO_X, manulla[1] - 48, -1, 'left', 48);
  column(['CLBAR', 'WPORT'], X0, manulla[1] + 116, 1);
  bend('MNLAJ', 'CLBAR', [X0, manulla[1] + (MAYO_X - X0)]);
  column(['CLMRS', 'BYHNS', 'CSREA', 'RSCMN'], MAYO_X, manulla[1] + 180, 1, 'left');

  // ---------- Heuston, Park West and the main line to Kildare ----------
  // Heuston's line leaves it at 45° and meets the Phoenix Park line coming down from Drumcondra, just above Park West.
  const heustonY = connollyY + 40;
  const heustonX = X3 - 56;
  const junction: Point = [X2, heustonY + (heustonX - X2)];
  stop('HSTON', [heustonX, heustonY], 'above', { labelDx: 0, labelWidth: 58, labelDy: -8 });
  stop('CHORC', [X2, junction[1] + 32], 'right', { labelWidth: 68 });
  column(['CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE'], X2, at('CHORC')[1] + 56, 1);
  bend('HSTON', 'CHORC', junction);
  bend('DCDRA', 'CHORC', [X2, connollyY - 6], junction);

  // ---------- Athlone and Galway ----------
  // Athlone sits west of Dublin: Mayo's line comes in from the north-west, Galway leaves south-west, and the line
  // from Dublin comes in from the east (see Portarlington, below).
  const athlone: Point = [X1, connollyY + 10];
  stop('ATLNE', athlone, 'left');
  const rscmn = at('RSCMN');
  bend('RSCMN', 'ATLNE', [MAYO_X, rscmn[1] + 30], [X0, rscmn[1] + 30 + (MAYO_X - X0)], [X0, athlone[1] - (X1 - X0)]);
  // Galway, a city, sits at the end of a sideways Y (geography bent to fit): the lines from Athlone (above) and
  // from Ennis (below) angle in to meet at Athenry, and one stem runs east through Oranmore to Galway, which gets a
  // city's circle and name. The Tullamore line keeps a lane further east to leave the stem room.
  const ballinasloeY = athlone[1] + (X1 - X0) + 24;
  column(['BSLOE', 'WLAWN', 'ATMON'], X0, ballinasloeY, 1, 'right', 28);
  bend('ATLNE', 'BSLOE', [X0, athlone[1] + (X1 - X0)]);
  const armX = 32;
  const athenry: Point = [X0 + armX, ballinasloeY + 2 * 28 + 70];
  bend('ATMON', 'ATHRY', [X0, athenry[1] - armX]);
  // Athenry's name sits up by the top of the Y (clear of the arm), Galway's above its circle a little lower, and
  // Oranmore's below the stem. Irish "Baile Átha an Rí" wraps onto two lines, so it sits higher still.
  stop('ATHRY', athenry, 'above', { labelDx: 10, labelDy: lang === 'ga' ? -40 : -31 });
  stop('ORNMR', [X0 + 60, athenry[1]], 'below', { labelDy: -10 });
  stop('GALWY', [X0 + 92, athenry[1]], 'above', { labelDx: -18, labelDy: -9 });
  // Craughwell fits above the Tullamore line's swing west; the rest of the line to Ennis waits until below it.
  stop('CRGHW', [X0, athenry[1] + armX + 16]);
  bend('ATHRY', 'CRGHW', [X0, athenry[1] + armX]);

  // ---------- Kildare, Portarlington, the Waterford line ----------
  // The main line leaves Kildare south-west for Portarlington (Monasterevin just past Kildare, its name to
  // the left); the Athlone line comes in from the north-west, swinging out west to leave that name room.
  const kildare = at('KDARE');
  const portarlington: Point = [X1, kildare[1] + (X2 - X1)];
  stop('MONVN', [X2 - 20, kildare[1] + 20], 'left');
  stop('PTRTN', portarlington, 'left');
  // Athlone is a sideways Y too: the line from Portarlington comes in from the east as its stem, and splits at
  // Athlone into Mayo's arm (up and west) and Galway's (down and west). The stem leaves Athlone straight east,
  // eases down at 45° into a lane of its own (Galway's stem needs the room west of it), names on the left, then
  // swings west round Monasterevin's name into Portarlington.
  const claraX = 40;
  const claraLaneX = X1 + 37;
  const stemEase = 14;
  stop('CLARA', [claraLaneX, athlone[1] + 51], 'left');
  stop('TMORE', [claraLaneX, athlone[1] + 81], 'left');
  bend('ATLNE', 'CLARA', [claraLaneX - stemEase, athlone[1]], [claraLaneX, athlone[1] + stemEase]);
  // A V at 45° both ways: down-left past Monasterevin's name, one corner at the west edge of the swing, then into
  // Portarlington.
  const swingFoot: Point = [claraX, portarlington[1] - (X1 - claraX)];
  bend('TMORE', 'PTRTN', [claraLaneX, swingFoot[1] - (claraLaneX - claraX)], swingFoot);
  // The Waterford line steps a little east of Kildare, giving the main line's names more room.
  const waterfordX = X2 + (lang === 'ga' ? 10 : 14);
  // Waterford is a through station here: the line from Kildare comes down to it, and the line from Limerick
  // Junction climbs up to it from Tipperary (see below), so its stations carry on down the same lane.
  column(['ATHY', 'CRLOW', 'MNEBG', 'KKNNY', 'THTWN', 'WFORD'], waterfordX, kildare[1] + 2 * ROW, 1, 'right', 46);
  // Below Waterford, up to the corner where the line from Limerick Junction turns into this lane: Tipperary sits a
  // little above the corner (a station on a bend reads as an end), and the others are spaced between.
  const waterfordLaneFoot: Point = [waterfordX, at('WFORD')[1] + 4 * 46];
  stop('TIPRY', [waterfordX, waterfordLaneFoot[1] - 40]);
  between(['CKOSR', 'CLMEL', 'CAHIR'], at('WFORD'), at('TIPRY'));
  bend('KDARE', 'ATHY', [X2, kildare[1] + 16], [waterfordX, kildare[1] + 32]);
  points.WFORD!.smallHubLabel = true;
  // Kilkenny is a big station, but its name has to fit between the Waterford and coast lines.
  points.KKNNY!.smallHubLabel = true;

  // ---------- Main line to Cork; Limerick, Ennis, Tralee ----------
  // The main line spreads out a little so Limerick Junction lines up with Limerick, below the Ennis line.
  const mainRow = 38;
  column(['PTLSE', 'BBRHY', 'TPMOR', 'THRLS', 'LMRKJ'], X1, portarlington[1] + mainRow, 1, 'right', mainRow);
  const lj = at('LMRKJ');
  // Limerick sits on the west edge, a little north of the junction (as it is): the Ennis line comes down to it,
  // the line to Limerick Junction leaves east and joins the main line at 45°, and the Nenagh line carries on
  // down the edge (geography bent to fit: it really runs north-east to Ballybrophy).
  const limerickY = lj[1] - 20;
  // Limerick's name sits above the line east to Limerick Junction, in the usual size so it stays clear of the
  // main line (Irish "Luimneach" breaks onto two lines).
  stop('LMRCK', [X0, limerickY], 'right', { labelDy: -16, smallHubLabel: true });
  column(['SXMBR', 'ENNIS', 'GORT', 'ARHAN'], X0, limerickY - 48, -1, 'right', 30);
  bend('LMRCK', 'LMRKJ', [X1 - (lj[1] - limerickY), limerickY]);
  // Limerick Junction to Waterford (geography bent to fit): east off the junction at 45°, down beside the main
  // line, then across to Tipperary at the foot of the Waterford lane, which it climbs to Waterford.
  const ljLaneX = X1 + 30;
  bend('LMRKJ', 'TIPRY', [ljLaneX, lj[1] + (ljLaneX - X1)], [ljLaneX, waterfordLaneFoot[1]], waterfordLaneFoot);
  // The Nenagh line: down from Limerick, ending at a stop for Ballybrophy on the main line (NENAGH_END: drawing
  // it back up to Ballybrophy would cross the main line and Limerick Junction's link).
  column(['CCONL', 'BHILL', 'NNAGH', 'CJRDN', 'RCREA', NENAGH_END], X0, limerickY + 40, 1);
  // Tralee is north-west of Mallow: its line climbs the west edge, below the Nenagh line.
  const traleeY = at(NENAGH_END)[1] + 56;
  const mallow: Point = [X1, traleeY + 5 * ROW + (X1 - X0) + 16];
  stop('MLLOW', mallow);
  between(['CVILL'], lj, mallow);
  column(['BTEER', 'MLSRT', 'RMORE', 'KLRNY', 'FFORE', 'TRLEE'], X0, mallow[1] - (X1 - X0) - 16, -1);
  bend('MLLOW', 'BTEER', [X0, mallow[1] - (X1 - X0)]);
  // Cork, then east along the harbour to Glounthaune: Midleton straight on, Cobh south.
  const corkY = mallow[1] + 4 * ROW;
  // Cork sits on the line down from Mallow, and the line curves east below it (no right angle at the station).
  stop('CORK', [X1, corkY - ROW], 'left');
  bend('CORK', 'LSLND', [X1, corkY]);
  [['LSLND', 140], ['GHANE', 180], ['CGTWL', 220], ['MDLTN', 260]].forEach(([code, x]) => stop(code as string, [x as number, corkY], 'angled'));
  column(['FOTA', 'CGLOE', 'RBROK', 'COBH'], 200, corkY + 2 * ROW, 1);
  bend('GHANE', 'FOTA', [200, corkY + 20]);

  // How wide each line's names may be before wrapping: from a name's start (18px from its line) to just
  // short of the next line over. Names that can't wrap (one long word) are kept within these by layout.
  const text = (width: number, codes: string[]) => {
    for (const code of codes) points[code]!.labelWidth ??= width + 8;
  };
  const right = X3 - 7 - 18;
  text(X1 - 7 - 18 - X0, ['NI_MOSSW', 'NI_ANTRM', 'NI_BMENA', 'NI_CULLY', 'NI_BMONY', 'NI_CROCK', 'NI_BELLA', 'NI_DERRY', 'CLBAR', 'WPORT', 'BSLOE', 'WLAWN', 'ATMON', 'CRGHW', 'ARHAN', 'GORT', 'ENNIS', 'SXMBR', 'LMRCK', 'CCONL', 'BHILL', 'NNAGH', 'CJRDN', 'RCREA', NENAGH_END, 'BTEER', 'MLSRT', 'RMORE', 'KLRNY', 'FFORE', 'TRLEE']);
  text(48, ['ATHRY']);
  text(58, ['GALWY']);
  // Portarlington's name sits left of it, over the line to Ennis, so it wraps clear of that line.
  points.PTRTN!.labelWidth = 52;
  text(70, ['NI_UNIV', 'NI_DHUVR', 'NI_PRUSH', 'NI_LARNH', 'NI_LARNT', 'NI_GLYNN', 'NI_MAGHM', 'NI_BCARY', 'NI_WHEAD', 'NI_DOWNS', 'NI_CFERG', 'NI_CLIPP', 'NI_TROOP', 'NI_GRNIS', 'NI_JORDN', 'NI_WABBY', 'NI_YORKG']);
  text(waterfordX - 7 - 18 - X1, ['PTLSE', 'BBRHY', 'TPMOR', 'THRLS', 'LMRKJ', 'CVILL', 'MLLOW']);
  text(60, ['CLARA', 'TMORE']);
  text(right - X2, ['CHORC', 'CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE']);
  text(right - waterfordX, ['ATHY', 'CRLOW', 'MNEBG', 'KKNNY', 'THTWN', 'WFORD', 'CKOSR', 'CLMEL', 'CAHIR', 'TIPRY']);
  text(right - m3X, ['HAFLD', 'DBYNE', 'M3WAY']);
  text(right - WEST_X - 3, Object.keys(points).filter((c) => points[c]!.x === WEST_X && points[c]!.label === 'right'));
  text(340 - 18 - X3 - 4, Object.keys(points).filter((c) => points[c]!.x === X3 && points[c]!.label === 'right'));
  // Angled names start a little higher, so their first letter clears the track (dark on dark otherwise).
  for (const p of Object.values(points)) if (p.label === 'angled') p.labelDy ??= -7;
  text(72, ['LXCON', 'LXLSA', 'MYNTH', 'KCOCK', 'MNLAJ', 'FXFRD', 'BALNA', 'CLMRS', 'BYHNS', 'CSREA', 'RSCMN', 'DCDRA', 'BBRDG']);

  const ys = Object.values(points).map((p) => p.y);
  const top = Math.min(...ys);
  const y = (v: number) => Math.round(40 + (v - top) * stretch);
  return {
    width: 340,
    height: y(Math.max(...ys)) + 60,
    points: Object.fromEntries(Object.entries(points).map(([code, p]) => [code, { ...p, y: y(p.y) }])),
    bends: Object.fromEntries(
      Object.entries(bends).map(([key, corners]) => [key, corners.map(([x, v]): Point => [x, y(v)])]),
    ),
    labelMaxWidth: 70,
    standIns: [{ code: NENAGH_END, for: 'BBRHY', link: ['BBRHY', 'RCREA'] }],
  };
}

/** The English layout; Irish uses a taller one (see NetworkMap). */
export const NETWORK_SCHEMATIC = networkSchematic();

/** Ends of lines that carry on through (degree 2) but are drawn as circles: termini and turn-backs. */
export const NETWORK_TERMINI = new Set(['BFSTC', 'LMRCK', 'CORK']);

/**
 * Where a long one-word name may break (a soft hyphen) when it's squeezed between two lines, keyed by the
 * name as shown, in either language. The Irish breaks fall between the parts of the name.
 */
const NAME_BREAKS: Record<string, string> = {
  Thomastown: 'Thomas\u00adtown',
  Portarlington: 'Portar\u00adlington',
  Craughwell: 'Craugh\u00adwell',
  Castleconnell: 'Castle\u00adconnell',
  Cloughjordan: 'Clough\u00adjordan',
  Waterford: 'Water\u00adford',
  Ballybrophy: 'Bally\u00adbrophy',
  Tipperary: 'Tipper\u00adary',
  Creachmhaoil: 'Creach\u00admhaoil',
  Luimneach: 'Luim\u00adneach',
  Sixmilebridge: 'Sixmile\u00adbridge',
  Ceatharlach: 'Ceathar\u00adlach',
  Clóirtheach: 'Clóir\u00adtheach',
  'Cill Chainnigh': 'Cill Chain\u00adnigh',
};

export const withBreaks = (name: string) => NAME_BREAKS[name] ?? name;
