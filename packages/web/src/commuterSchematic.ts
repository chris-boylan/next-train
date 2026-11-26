/**
 * Hand-placed, geography-inspired layout for the Dublin commuter preview. North is up. Connolly sits on
 * the east side: the Northern line runs north up the coast and the South Eastern line south down it.
 * Western heads north-west from Drumcondra and Broombridge to Maynooth (M3 Parkway branching at
 * Clonsilla, Docklands back towards the city). Heuston sits west of Connolly, with South Western running
 * south-west to Kildare and the Phoenix Park tunnel link from Drumcondra meeting it at Park West.
 */
import type { Schematic, SchematicPoint } from './schematics';

const ROW = 34;
const COAST_X = 230; // Connolly, the Northern and the South Eastern lines
const WEST_X = 30; // Western (north-west) and South Western (south-west) lines
const CONNOLLY_Y = 700;

const points: Record<string, SchematicPoint> = {};
/** Places stations one row apart up (step -1) or down (step 1) a vertical line. */
const column = (codes: string[], x: number, startY: number, step: 1 | -1) =>
  codes.forEach((code, i) => (points[code] = { x, y: startY + step * ROW * i, label: 'right' }));

points.CNLLY = { x: COAST_X, y: CONNOLLY_Y, label: 'right' };
// Northern: north up the coast to Dundalk.
column(
  ['CTARF', 'KLSTR', 'HTOWN', 'RAHNY', 'KBRCK', 'HWTHJ', 'GRGRD', 'PMNCK', 'MHIDE', 'DBATE', 'RLUSK', 'SKRES', 'BBRGN', 'GSTON', 'LTOWN', 'DGHDA', 'DDALK'],
  COAST_X,
  CONNOLLY_Y - ROW,
  -1,
);
// South Eastern: south down the coast to Gorey.
column(
  ['TARA', 'PERSE', 'GCDK', 'LDWNE', 'SMONT', 'SIDNY', 'BTSTN', 'BROCK', 'SEAPT', 'SHILL', 'DLERY', 'SCOVE', 'GLGRY', 'DLKEY', 'KILNY', 'SKILL', 'WBROK', 'BRAY', 'GSTNS', 'KCOOL', 'WLOW', 'RDRUM', 'ARKLW', 'GOREY'],
  COAST_X,
  CONNOLLY_Y + ROW,
  1,
);

// Connolly, Drumcondra and Broombridge sit on one straight 45° line heading north-west, which carries on
// until it curves up into the Western line by Pelletstown. Each name sits on a side clear of the lines.
const DIAGONAL = (dx: number): [number, number] => [COAST_X - dx, CONNOLLY_Y - dx];
points.DCDRA = { x: DIAGONAL(50)[0], y: DIAGONAL(50)[1], label: 'left' };
points.BBRDG = { x: DIAGONAL(105)[0], y: DIAGONAL(105)[1], label: 'left' };
// Docklands' spur leaves Broombridge at 45°, then curves round to run east towards the city. Its name sits
// above, where there's more room between the diagonal and the coastal line.
points.DCKLS = { x: 178, y: 570, label: 'above', labelDx: -40 };

// Western: north-west to Clonsilla, then Maynooth carries straight on while M3 Parkway branches right.
column(['PELTN', 'ASHTN', 'PHNPK', 'CNOCK', 'CMINE', 'CLSLA'], WEST_X, 460, -1);
column(['HAFLD', 'DBYNE', 'M3WAY'], 100, 220, -1);
column(['LXCON', 'LXLSA', 'MYNTH'], WEST_X, 110, -1);

// Heuston, west of Connolly, and South Western to Kildare.
// Heuston sits east of Park West. As on the real track, its line and the Phoenix Park tunnel line from
// Drumcondra meet at a junction just above Park West and run into it together, so neither crosses the
// other or Park West's name.
const HEUSTON_JUNCTION: [number, number] = [WEST_X, 790];
points.HSTON = { x: 138, y: 790, label: 'right' };
column(['CHORC', 'CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE', 'MONVN', 'PTRTN', 'PTLSE'], WEST_X, 840, 1);

const bends: Record<string, [number, number][]> = {
  // The 45° line carries straight on from Broombridge, then curves up into the Western line.
  'BBRDG|PELTN': [DIAGONAL(COAST_X - WEST_X)],
  'BBRDG|DCKLS': [[150, 570]],
  // Heuston's line runs west to the junction; the tunnel line comes down to it from Drumcondra.
  'HSTON|CHORC': [HEUSTON_JUNCTION],
  'DCDRA|CHORC': [HEUSTON_JUNCTION],
  // M3 Parkway peels off right just north of Clonsilla.
  'CLSLA|HAFLD': [
    [WEST_X, 260],
    [100, 260],
  ],
};

// Lift everything so the northernmost stations (Dundalk, Maynooth) sit near the top of the map.
const topY = Math.min(...Object.values(points).map((p) => p.y));
const lift = topY - 40;

export const COMMUTER_SCHEMATIC: Schematic = {
  width: 340,
  height: CONNOLLY_Y + ROW * 24 + 40 - lift,
  points: Object.fromEntries(Object.entries(points).map(([code, p]) => [code, { ...p, y: p.y - lift }])),
  bends: Object.fromEntries(
    Object.entries(bends).map(([key, corners]) => [key, corners.map(([x, y]): [number, number] => [x, y - lift])]),
  ),
  // Lines run side by side, so long names wrap onto a second line rather than run into the next line.
  labelMaxWidth: 100,
};
