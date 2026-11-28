/**
 * Hand-placed maps of the Luas, in the style of the other line maps: each line on its own (a vertical line with
 * names on the right, the city end at the top), and both together for All.
 *
 * Red: The Point at the top, down through Busáras (Connolly's spur leaves it up and to the side) and out to
 * Belgard, where the Tallaght branch leaves down and to the left and the line carries on to Saggart.
 *
 * Green: Broombridge at the top, down to Brides Glen. Through the city centre the line splits into its one-way
 * loop, drawn as two sides: northbound on the left (Westmoreland, O'Connell – GPO, O'Connell – Upper), southbound
 * on the right (Parnell, Marlborough, Trinity), with arrows the way trams run. At the top the loop's three pieces
 * of track (O'Connell – Upper to Dominick, Dominick to Parnell, and "Parnell" trams' turn from O'Connell – Upper
 * to Parnell) all meet at one junction just below Dominick, as the streets do, rather than each taking its own
 * line between the three stops. At the bottom both sides meet at Dawson.
 *
 * All: both lines on one map, the Red line running across through the Green line's loop (see luasAllSchematic).
 */
import { LUAS_ONE_WAY } from '@dart-times/core';
import type { Schematic, SchematicPoint } from './schematics';

const ROW = 34;
const TOP = 40;
/** The gap between a line and a branch (or the loop's other side) beside it. */
const SIDE = 40;
/** A branch leaves at 45°, a little more than a row from its junction to its first stop. */
const STEP = 46;

const lu = (code: string) => `LU_${code}`;
const pair = (a: string, b: string) => `${lu(a)}|${lu(b)}`;

const RED_EAST = ['TPT', 'SDK', 'MYS', 'GDK', 'BUS'];
const RED_TRUNK = ['ABB', 'JER', 'FOU', 'SMI', 'MUS', 'HEU', 'JAM', 'FAT', 'RIA', 'SUI', 'GOL', 'DRI', 'BLA', 'BLU', 'KYL', 'RED', 'KIN', 'BEL'];
const SAGGART = ['FET', 'CVN', 'CIT', 'FOR', 'SAG'];
const TALLAGHT = ['COO', 'HOS', 'TAL'];
const GREEN_NORTH = ['BRO', 'CAB', 'PHI', 'GRA', 'BRD', 'DOM'];
const GREEN_SOUTH = ['STS', 'HAR', 'CHA', 'RAN', 'BEE', 'COW', 'MIL', 'WIN', 'DUN', 'BAL', 'KIL', 'STI', 'SAN', 'CPK', 'GLE', 'GAL', 'LEO', 'BAW', 'CCK', 'LAU', 'CHE', 'BRI'];

/** Places codes one row apart down from `y` at `x`; returns the next row's y. */
function column(
  points: Record<string, SchematicPoint>,
  codes: string[],
  x: number,
  y: number,
  label: SchematicPoint['label'] = 'right',
  labelWidth?: number,
): number {
  codes.forEach((code, i) => (points[lu(code)] = { x, y: y + i * ROW, label, ...(labelWidth && { labelWidth }) }));
  return y + codes.length * ROW;
}

/**
 * The Green line's loop, its northbound side at `x` and southbound side to its right, below Dominick at `dominick`.
 * Returns Dawson's y and the loop's corners. `leftWidth` wraps the northbound side's names.
 */
function greenLoop(points: Record<string, SchematicPoint>, x: number, dominick: number, leftWidth: number) {
  const side = SIDE;
  const right = x + side;
  // The junction where the three pieces of track at the top of the loop meet: just below Dominick, so the
  // southbound side leaves clear of Dominick's name.
  const junction: [number, number] = [x, dominick + 24];
  const turn: [number, number] = [right, junction[1] + side];
  const loopTop = turn[1] + 10;
  column(points, ['OUP', 'OGP', 'WES'], x, loopTop, 'left', leftWidth);
  const loopBottom = column(points, ['PAR', 'MAR', 'TRY'], right, loopTop) - ROW;
  const dawson = loopBottom + STEP;
  const bends: Schematic['bends'] = {
    // Dominick to Parnell, and O'Connell – Upper round to Parnell: both by the junction, then down to the right.
    [pair('DOM', 'PAR')]: [junction, turn],
    [pair('OUP', 'PAR')]: [junction, turn],
    // Out of the southbound side into Dawson at 45°.
    [pair('TRY', 'DAW')]: [[right, dawson - side]],
  };
  // The turn back at the junction is sharp, so it runs on the other two pieces' track instead of drawing a curve
  // of its own between them.
  const curves: Schematic['curves'] = { [pair('OUP', 'PAR')]: 0 };
  return { dawson, bends, curves };
}

/** The loop's one-way arrows, less the turn from O'Connell – Upper to Parnell: it runs entirely on track the
 *  other arrows already mark, and its own arrow would sit beside Dominick-to-Parnell's. */
const ARROWS = LUAS_ONE_WAY.filter(([a, b]) => !(a === lu('OUP') && b === lu('PAR')));

export function luasRedSchematic(): Schematic {
  const width = 340;
  const x = 150;
  const leftLabel = x - 20;
  const points: Record<string, SchematicPoint> = {};
  let y = column(points, RED_EAST, x, TOP);
  const busaras = y - ROW;
  // Connolly's spur: up and to the left from Busáras, its name on the left.
  points[lu('CON')] = { x: x - SIDE, y: busaras - STEP - 10, label: 'left', labelWidth: leftLabel };
  y = column(points, RED_TRUNK, x, y);
  const belgard = y - ROW;
  column(points, SAGGART, x, y);
  // The Tallaght branch: down and to the left from Belgard, names on the left.
  column(points, TALLAGHT, x - SIDE, belgard + STEP + 12, 'left', leftLabel);
  return finish(width, points, {
    bends: {
      [pair('BUS', 'CON')]: [[x - SIDE, busaras - SIDE]],
      [pair('BEL', 'COO')]: [[x - SIDE, belgard + SIDE]],
    },
    labelMaxWidth: width - x - 24,
  });
}

export function luasGreenSchematic(): Schematic {
  const width = 340;
  const x = 150;
  const points: Record<string, SchematicPoint> = {};
  const dominick = column(points, GREEN_NORTH, x, TOP) - ROW;
  const loop = greenLoop(points, x, dominick, x - 20);
  column(points, ['DAW'], x, loop.dawson, 'left', x - 20);
  column(points, GREEN_SOUTH, x, loop.dawson + ROW);
  return finish(width, points, { bends: loop.bends, curves: loop.curves, oneWay: ARROWS, labelMaxWidth: width - x - 24 });
}

/**
 * Both lines on one map, the Red crossing the Green as it does in the city. The Green runs down the map as on its
 * own, and the Red runs across it from Heuston (on the left) to The Point, through the loop between O'Connell –
 * GPO and Marlborough: Abbey Street sits between the loop's two sides, Jervis and the stops to Museum to the
 * left, Busáras and the Docklands to the right, with Connolly's spur up from Busáras. A dashed line joins Abbey
 * Street to O'Connell – GPO and Marlborough, changing line on foot. Past Museum the Red sweeps round a rounded
 * corner and down the left of the map, through Heuston to Belgard, where the Tallaght branch leaves to the right,
 * then on to Saggart.
 *
 * Names along the level stretch are angled: up to the right west of the Green, down to the right east of it (the
 * loop's own names take the space above), and Abbey Street's sits under it inside the loop.
 */
export function luasAllSchematic(): Schematic {
  const width = 340;
  const green = 136;
  // The loop wide enough for Abbey Street's stop and name between its sides.
  const side = 52;
  const points: Record<string, SchematicPoint> = {};

  const dominick = column(points, GREEN_NORTH, green, TOP) - ROW;
  const junction: [number, number] = [green, dominick + 24];
  const turn: [number, number] = [green + side, junction[1] + side];
  const upper = turn[1] + 10;
  // The loop's rows: O'Connell – Upper and Parnell, O'Connell – GPO and Marlborough, then the Red line, then
  // Westmoreland and Trinity, spaced so the angled names either side of the Red line clear the loop's names.
  const gpo = upper + 46;
  const red = gpo + 82;
  const south = red + 72;
  const betweenLabel = green - 38;
  const loopSide = (codes: string[], x: number, label: SchematicPoint['label'], labelWidth: number) =>
    codes.forEach((code, i) => (points[lu(code)] = { x, y: [upper, gpo, south][i]!, label, labelWidth }));
  loopSide(['OUP', 'OGP', 'WES'], green, 'left', betweenLabel);
  loopSide(['PAR', 'MAR', 'TRY'], green + side, 'right', width - (green + side) - 18);
  const dawson = south + side + 6;
  // Dawson's name on the right, clear of the track coming in from Trinity: the Red line takes the left.
  points[lu('DAW')] = { x: green, y: dawson, label: 'right', labelDx: 8 };
  column(points, GREEN_SOUTH, green, dawson + ROW);

  // The Red line across: Museum to Jervis west of the Green, Abbey Street inside the loop, Busáras to The Point
  // east of it. The corner west of Museum is where the line turns down the map: far enough from Museum, and
  // Heuston far enough below it, for a full curve.
  const heuston = 12;
  const corner: [number, number] = [heuston, red];
  ['MUS', 'SMI', 'FOU', 'JER'].forEach((code, i) => (points[lu(code)] = { x: heuston + 42 + i * 18.5, y: red, label: 'angled' }));
  const abbey = green + side / 2;
  points[lu('ABB')] = { x: abbey, y: red, label: 'belowCentre', labelWidth: side - 12 };
  // The walk to the Green line: up from Abbey Street, splitting at 45° to O'Connell – GPO and Marlborough.
  const fork: [number, number] = [abbey, gpo + side / 2];
  // Busáras far enough along that its name, angled down, clears Trinity's.
  const busaras = green + side + 34;
  ['BUS', 'GDK', 'MYS', 'SDK', 'TPT'].forEach((code, i) => (points[lu(code)] = { x: busaras + i * 19.5, y: red, label: 'angledBelow' }));
  // Connolly: a short spur up and to the right from Busáras, under Marlborough's name; short, so its name (in an
  // interchange's bigger capitals) ends before the screen's edge.
  const spur = 16;
  points[lu('CON')] = { x: busaras + spur, y: red - spur - 16, label: 'right' };

  // Down the left: Heuston just round the corner, then its stops from below Westmoreland's name; names on the right.
  const trunkLabel = green - heuston - 28;
  points[lu('HEU')] = { x: heuston, y: red + 46, label: 'right', labelWidth: trunkLabel };
  const belgard = column(points, ['JAM', 'FAT', 'RIA', 'SUI', 'GOL', 'DRI', 'BLA', 'BLU', 'KYL', 'RED', 'KIN', 'BEL'], heuston, south + 32, 'right', trunkLabel) - ROW;
  // The Tallaght branch: down and to the right from Belgard, its three stops ahead of Saggart's, so the Saggart
  // line's names never cross its track.
  const branch = 22;
  const tallaght = belgard + branch + 16;
  column(points, TALLAGHT, heuston + branch, tallaght, 'right', trunkLabel - branch);
  column(points, SAGGART, heuston, tallaght + TALLAGHT.length * ROW, 'right', trunkLabel);

  return finish(width, points, {
    bends: {
      [pair('DOM', 'PAR')]: [junction, turn],
      [pair('OUP', 'PAR')]: [junction, turn],
      [pair('TRY', 'DAW')]: [[green + side, dawson - side]],
      [pair('BUS', 'CON')]: [[busaras + spur, red - spur]],
      [pair('BEL', 'COO')]: [[heuston + branch, belgard + branch]],
      [pair('MUS', 'HEU')]: [corner],
    },
    curves: { [pair('OUP', 'PAR')]: 0 },
    oneWay: ARROWS,
    labelMaxWidth: width - green - 22,
    transfers: [
      { from: lu('ABB'), to: lu('OGP'), via: [fork] },
      { from: lu('ABB'), to: lu('MAR'), via: [fork] },
    ],
  });
}

function finish(width: number, points: Record<string, SchematicPoint>, rest: Omit<Schematic, 'width' | 'height' | 'points'>): Schematic {
  const ys = Object.values(points).map((p) => p.y);
  return { width, height: Math.max(...ys) + TOP, points, ...rest };
}
