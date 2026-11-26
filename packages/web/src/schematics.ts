/**
 * Hand-placed schematic layouts, for services whose shape reads better closer to the real geography
 * than the automatic top-to-bottom layout. Positions are in pixels on a phone-width map, with lines
 * kept horizontal, vertical or diagonal in the Beck style.
 */
import type { ServiceId } from '@dart-times/core';

/** Where a station's name sits: either side of a vertical line, under or over the dot, or angled above a horizontal line. */
export type LabelPlacement = 'right' | 'left' | 'below' | 'above' | 'angled';

export interface SchematicPoint {
  x: number;
  y: number;
  label: LabelPlacement;
  /** Shift the label sideways (px) to clear a nearby line, e.g. a negative value moves it left. */
  labelDx?: number;
  /** Wrap this label wider than this; overrides the map's labelMaxWidth. */
  labelWidth?: number;
}

export interface Schematic {
  width: number;
  height: number;
  points: Record<string, SchematicPoint>;
  /**
   * Corners a connection passes through between two stations, keyed "FROM|TO" in drawing order.
   * Every corner is drawn rounded, so lines sweep rather than meet at right angles.
   */
  bends?: Record<string, [number, number][]>;
  /** Wrap names wider than this onto a second line (for maps with lines side by side). */
  labelMaxWidth?: number;
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
      CORK: { x: 76, y: 260, label: 'below' },
      LSLND: { x: 118, y: 260, label: 'angled' },
      GHANE: { x: 160, y: 260, label: 'angled' },
      CGTWL: { x: 204, y: 260, label: 'angled' },
      MDLTN: { x: 248, y: 260, label: 'angled' },
      FOTA: { x: 196, y: 340, label: 'right' },
      CGLOE: { x: 196, y: 395, label: 'right' },
      RBROK: { x: 196, y: 450, label: 'right' },
      COBH: { x: 196, y: 500, label: 'right' },
    },
    bends: {
      // The Mallow line comes south and sweeps east into Cork.
      'MLLOW|CORK': [[34, 260]],
      // The Cobh line leaves Glounthaune heading east, then curves south past Fota.
      'GHANE|FOTA': [[196, 260]],
    },
  },
};
