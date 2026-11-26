/**
 * Hand-placed schematic layouts, for services whose shape reads better closer to the real geography
 * than the automatic top-to-bottom layout. Positions are in pixels on a phone-width map, with lines
 * kept horizontal, vertical or diagonal in the Beck style.
 */
import type { ServiceId } from '@dart-times/core';

/** Where a station's name sits: beside a vertical line, under the dot, or angled above a horizontal line. */
export type LabelPlacement = 'right' | 'below' | 'angled';

export interface SchematicPoint {
  x: number;
  y: number;
  label: LabelPlacement;
}

export interface Schematic {
  width: number;
  height: number;
  points: Record<string, SchematicPoint>;
}

export const SCHEMATICS: Partial<Record<ServiceId, Schematic>> = {
  // Cork: Mallow is north of the city; the main line runs east along the harbour to Glounthaune, where
  // the Midleton line carries on east and the Cobh line drops south past Fota.
  cork: {
    width: 340,
    height: 520,
    points: {
      // Spaced so the longest angled name (Irish "Mainistir na Corann") still fits a phone's width.
      MLLOW: { x: 34, y: 50, label: 'right' },
      CORK: { x: 34, y: 260, label: 'below' },
      LSLND: { x: 86, y: 260, label: 'angled' },
      GHANE: { x: 138, y: 260, label: 'angled' },
      CGTWL: { x: 192, y: 260, label: 'angled' },
      MDLTN: { x: 244, y: 260, label: 'angled' },
      FOTA: { x: 138, y: 330, label: 'right' },
      CGLOE: { x: 138, y: 390, label: 'right' },
      RBROK: { x: 138, y: 450, label: 'right' },
      COBH: { x: 138, y: 500, label: 'right' },
    },
  },
};
