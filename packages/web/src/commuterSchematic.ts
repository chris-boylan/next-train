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

// The junctions west of Connolly, each with its name on a side clear of the other lines.
points.DCDRA = { x: 178, y: 668, label: 'left' };
points.BBRDG = { x: 110, y: 615, label: 'left' };
points.DCKLS = { x: 166, y: 570, label: 'below' };

// Western: north-west to Clonsilla, then Maynooth carries straight on while M3 Parkway branches right.
column(['PELTN', 'ASHTN', 'PHNPK', 'CNOCK', 'CMINE', 'CLSLA'], WEST_X, 540, -1);
column(['HAFLD', 'DBYNE', 'M3WAY'], 100, 300, -1);
column(['LXCON', 'LXLSA', 'MYNTH'], WEST_X, 190, -1);

// Heuston, west of Connolly, and South Western to Kildare.
// Heuston sits south of the Phoenix Park tunnel line (Drumcondra–Park West), not on it.
points.HSTON = { x: 130, y: 790, label: 'right' };
column(['CHORC', 'CLDKN', 'KISHO', 'ADAMF', 'HZLCH', 'SALNS', 'NBRGE', 'CURAH', 'KDARE'], WEST_X, 825, 1);

const bends: Record<string, [number, number][]> = {
  // Broombridge to the Western line: up, then across to the north-west column.
  'BBRDG|PELTN': [
    [110, 580],
    [WEST_X, 580],
  ],
  // Docklands leaves the same way, then heads east back towards the city.
  'BBRDG|DCKLS': [[110, 585]],
  // M3 Parkway peels off right just north of Clonsilla.
  'CLSLA|HAFLD': [
    [WEST_X, 340],
    [100, 340],
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
