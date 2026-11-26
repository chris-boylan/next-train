/**
 * Hand-placed, geography-inspired layout for the Dublin commuter map. North is up. Connolly sits on the
 * east side: the Northern line runs north up the coast and the South Eastern line south down it. Western
 * heads north-west from Drumcondra and Broombridge to Maynooth (M3 Parkway branching at Clonsilla,
 * Docklands back towards the city). Heuston sits west of Connolly, with South Western running south-west
 * to Portlaoise and the Phoenix Park tunnel link from Drumcondra meeting it at Park West.
 *
 * The gap between stations is a parameter: Irish names are longer and wrap onto more lines, so the map
 * spaces stations further apart in Irish.
 */
import type { Schematic, SchematicPoint } from './schematics';

const COAST_X = 230; // Connolly, the Northern and the South Eastern lines
const WEST_X = 30; // Western (north-west) and South Western (south-west) lines
const M3_X = 100;
const CONNOLLY_Y = 700;
/** Label widths: names beside the coastal lines must fit before the screen edge; the western lines have
 *  room to the coastal line, so their names wrap less. */
const COAST_LABEL = 100;
const WEST_LABEL = 160;
const M3_LABEL = 110;

export function commuterSchematic(row: number): Schematic {
  const points: Record<string, SchematicPoint> = {};
  /** Places stations one row apart up (step -1) or down (step 1) a vertical line. */
  const column = (codes: string[], x: number, startY: number, step: 1 | -1, labelWidth: number) =>
    codes.forEach((code, i) => (points[code] = { x, y: startY + step * row * i, label: 'right', labelWidth }));

  points.CNLLY = { x: COAST_X, y: CONNOLLY_Y, label: 'right', labelWidth: COAST_LABEL };
  // Northern: north up the coast to Dundalk.
  column(
    ['CTARF', 'KLSTR', 'HTOWN', 'RAHNY', 'KBRCK', 'HWTHJ', 'GRGRD', 'PMNCK', 'MHIDE', 'DBATE', 'RLUSK', 'SKRES', 'BBRGN', 'GSTON', 'LTOWN', 'DGHDA', 'DDALK'],
    COAST_X,
    CONNOLLY_Y - row,
    -1,
    COAST_LABEL,
  );
  // South Eastern: south down the coast to Gorey.
  column(
    ['TARA', 'PERSE', 'GCDK', 'LDWNE', 'SMONT', 'SIDNY', 'BTSTN', 'BROCK', 'SEAPT', 'SHILL', 'DLERY', 'SCOVE', 'GLGRY', 'DLKEY', 'KILNY', 'SKILL', 'WBROK', 'BRAY', 'GSTNS', 'KCOOL', 'WLOW', 'RDRUM', 'ARKLW', 'GOREY'],
    COAST_X,
    CONNOLLY_Y + row,
    1,
    COAST_LABEL,
  );

  // Connolly, Drumcondra and Broombridge sit on one straight 45° line heading north-west, which carries on
  // until it curves up into the Western line by Pelletstown. Each name sits on a side clear of the lines.
  const diagonal = (dx: number): [number, number] => [COAST_X - dx, CONNOLLY_Y - dx];
  points.DCDRA = { x: diagonal(50)[0], y: diagonal(50)[1], label: 'left', labelWidth: 110 };
  points.BBRDG = { x: diagonal(105)[0], y: diagonal(105)[1], label: 'left', labelWidth: 110 };
  // Docklands' spur leaves Broombridge at 45°, then curves round to run east towards the city. Its name sits
  // above, where there's more room between the diagonal and the coastal line.
  points.DCKLS = { x: 178, y: 570, label: 'above', labelDx: -40, labelWidth: 110 };

  // Western: north-west to Clonsilla, then M3 Parkway branches right and Maynooth carries straight on. The
  // stations chain upwards so the M3 branch and the Maynooth stations never share rows.
  const westernStart = 460;
  column(['PELTN', 'ASHTN', 'PHNPK', 'CNOCK', 'CMINE', 'CLSLA'], WEST_X, westernStart, -1, WEST_LABEL);
  const clonsillaY = westernStart - 5 * row;
  const m3BendY = clonsillaY - 40;
  column(['HAFLD', 'DBYNE', 'M3WAY'], M3_X, m3BendY - 40, -1, M3_LABEL);
  const m3TopY = m3BendY - 40 - 2 * row;
  column(['LXCON', 'LXLSA', 'MYNTH'], WEST_X, m3TopY - 50, -1, WEST_LABEL);

  // Heuston sits east of Park West. As on the real track, its line and the Phoenix Park tunnel line from
  // Drumcondra meet at a junction just above Park West and run into it together, so neither crosses the
  // other or Park West's name.
  const heustonJunction: [number, number] = [WEST_X, 790];
  points.HSTON = { x: 138, y: 790, label: 'right', labelWidth: 80 };
  column(['CHORC', 'CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE', 'MONVN', 'PTRTN', 'PTLSE'], WEST_X, 840, 1, WEST_LABEL);

  const bends: Record<string, [number, number][]> = {
    // The 45° line carries straight on from Broombridge, then curves up into the Western line.
    'BBRDG|PELTN': [diagonal(COAST_X - WEST_X)],
    'BBRDG|DCKLS': [[150, 570]],
    // Heuston's line runs west to the junction; the tunnel line comes down to it from Drumcondra.
    'HSTON|CHORC': [heustonJunction],
    'DCDRA|CHORC': [heustonJunction],
    // M3 Parkway peels off right just north of Clonsilla.
    'CLSLA|HAFLD': [
      [WEST_X, m3BendY],
      [M3_X, m3BendY],
    ],
  };

  // Lift everything so the northernmost stations (Dundalk, Maynooth) sit near the top of the map.
  const ys = Object.values(points).map((p) => p.y);
  const lift = Math.min(...ys) - 40;
  return {
    width: 340,
    height: Math.max(...ys) - lift + 50,
    points: Object.fromEntries(Object.entries(points).map(([code, p]) => [code, { ...p, y: p.y - lift }])),
    bends: Object.fromEntries(
      Object.entries(bends).map(([key, corners]) => [key, corners.map(([x, y]): [number, number] => [x, y - lift])]),
    ),
    // Lines run side by side, so long names wrap onto another line rather than run into the next line.
    labelMaxWidth: COAST_LABEL,
  };
}

/** The English spacing; Irish uses wider rows (see CommuterMap). */
export const COMMUTER_SCHEMATIC = commuterSchematic(34);
