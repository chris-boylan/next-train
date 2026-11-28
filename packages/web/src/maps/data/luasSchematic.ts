/**
 * Hand-placed maps of the two Luas lines, one each, in the style of the other line maps: a vertical line with
 * names on the right, the city end at the top.
 *
 * Red: The Point at the top, down through Busáras (Connolly's spur leaves it up and to the left) and out to
 * Belgard, where the Tallaght branch leaves down and to the left and the line carries on to Saggart.
 *
 * Green: Broombridge at the top, down to Brides Glen. Through the city centre the line splits into its one-way
 * loop, drawn as two sides: northbound on the left (Westmoreland, O'Connell – GPO, O'Connell – Upper), southbound
 * on the right (Parnell, Marlborough, Trinity), with arrows the way trams run. It splits at Dominick and Dawson;
 * "Parnell" trams cross from O'Connell – Upper to Parnell at the top of the loop.
 */
import { LUAS_ONE_WAY } from '@dart-times/core';
import type { Schematic, SchematicPoint } from './schematics';

const WIDTH = 340;
const ROW = 34;
const TOP = 40;
/** The main line, and the branches either side of it. */
const X = 150;
const LEFT = X - 40;
const RIGHT = X + 40;
/** A branch leaves at 45°, a little more than a row from its junction to its first stop. */
const STEP = 46;
const LEFT_LABEL = X - 20;

const lu = (code: string) => `LU_${code}`;

function build(points: Record<string, SchematicPoint>, bends: Schematic['bends'], oneWay?: [string, string][]): Schematic {
  const ys = Object.values(points).map((p) => p.y);
  // Long names wrap rather than run off the screen: on the right before its edge, on the left before the line.
  return { width: WIDTH, height: Math.max(...ys) + TOP, points, bends, labelMaxWidth: WIDTH - X - 24, ...(oneWay && { oneWay }) };
}

/** Places codes one row apart down the main line from `y`, names on the right; returns the next row's y. */
function column(points: Record<string, SchematicPoint>, codes: string[], x: number, y: number, label: SchematicPoint['label'] = 'right'): number {
  codes.forEach((code, i) => (points[lu(code)] = { x, y: y + i * ROW, label, ...(label === 'left' && { labelWidth: LEFT_LABEL }) }));
  return y + codes.length * ROW;
}

export function luasRedSchematic(): Schematic {
  const points: Record<string, SchematicPoint> = {};
  let y = column(points, ['TPT', 'SDK', 'MYS', 'GDK', 'BUS'], X, TOP);
  const busaras = y - ROW;
  // Connolly's spur: up and to the left from Busáras, its name on the left.
  points[lu('CON')] = { x: LEFT, y: busaras - STEP - 10, label: 'left', labelWidth: LEFT_LABEL };
  y = column(points, ['ABB', 'JER', 'FOU', 'SMI', 'MUS', 'HEU', 'JAM', 'FAT', 'RIA', 'SUI', 'GOL', 'DRI', 'BLA', 'BLU', 'KYL', 'RED', 'KIN', 'BEL'], X, y);
  const belgard = y - ROW;
  column(points, ['FET', 'CVN', 'CIT', 'FOR', 'SAG'], X, y);
  // The Tallaght branch: down and to the left from Belgard, names on the left.
  column(points, ['COO', 'HOS', 'TAL'], LEFT, belgard + STEP + 12, 'left');
  return build(points, {
    [`${lu('BUS')}|${lu('CON')}`]: [[LEFT, busaras - (X - LEFT)]],
    [`${lu('BEL')}|${lu('COO')}`]: [[LEFT, belgard + (X - LEFT)]],
  });
}

export function luasGreenSchematic(): Schematic {
  const points: Record<string, SchematicPoint> = {};
  let y = column(points, ['BRO', 'CAB', 'PHI', 'GRA', 'BRD', 'DOM'], X, TOP);
  const dominick = y - ROW;
  // Dominick's and Dawson's names go on the left, clear of the loop's southbound side leaving them to the right.
  points[lu('DOM')]!.label = 'left';
  points[lu('DOM')]!.labelWidth = LEFT_LABEL;
  // The loop: northbound up the left side (names on the left), southbound down the right side (names on the right).
  const loopTop = dominick + STEP;
  column(points, ['OUP', 'OGP', 'WES'], X, loopTop, 'left');
  y = column(points, ['PAR', 'MAR', 'TRY'], RIGHT, loopTop);
  const loopBottom = y - ROW;
  const dawson = loopBottom + STEP;
  column(points, ['DAW'], X, dawson, 'left');
  column(
    points,
    ['STS', 'HAR', 'CHA', 'RAN', 'BEE', 'COW', 'MIL', 'WIN', 'DUN', 'BAL', 'KIL', 'STI', 'SAN', 'CPK', 'GLE', 'GAL', 'LEO', 'BAW', 'CCK', 'LAU', 'CHE', 'BRI'],
    X,
    dawson + ROW,
  );
  return build(
    points,
    {
      // Into and out of the loop's southbound side at 45°.
      [`${lu('DOM')}|${lu('PAR')}`]: [[RIGHT, dominick + (RIGHT - X)]],
      [`${lu('TRY')}|${lu('DAW')}`]: [[RIGHT, dawson - (RIGHT - X)]],
    },
    LUAS_ONE_WAY,
  );
}
