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
  /** Shift the label up (negative) or down (px), e.g. to sit just above a line leaving sideways. */
  labelDy?: number;
  /** A big station whose name keeps the map's usual size (still bold), where a larger one wouldn't fit. */
  smallHubLabel?: boolean;
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
  /** Curve radius for a connection's corners, keyed "A|B" like bends, where it should sweep wider than usual. */
  curves?: Record<string, number>;
  /** Wrap names wider than this onto a second line (for maps with lines side by side). */
  labelMaxWidth?: number;
}

export const SCHEMATICS: Partial<Record<ServiceId, Schematic>> = {
  // Cork: Mallow is north of the city; the main line runs east along the harbour to Glounthaune, where
  // the Midleton line carries on east and the Cobh line drops south past Fota.
  cork: {
    width: 340,
    height: 545,
    points: {
      // Spaced so the longest angled name (Irish "Mainistir na Corann") still fits a phone's width.
      MLLOW: { x: 34, y: 50, label: 'right' },
      CORK: { x: 76, y: 260, label: 'below' },
      LSLND: { x: 118, y: 260, label: 'angled' },
      GHANE: { x: 160, y: 260, label: 'angled' },
      CGTWL: { x: 204, y: 260, label: 'angled' },
      MDLTN: { x: 248, y: 260, label: 'angled' },
      FOTA: { x: 196, y: 365, label: 'right' },
      CGLOE: { x: 196, y: 420, label: 'right' },
      RBROK: { x: 196, y: 475, label: 'right' },
      COBH: { x: 196, y: 525, label: 'right' },
    },
    bends: {
      // The Mallow line comes south and sweeps east into Cork.
      'MLLOW|CORK': [[34, 260]],
      // Tube-map style: the Cobh line leaves Glounthaune on a straight 45° diagonal (the dot sits on the split),
      // then turns south in one compact corner, the same size as the map's other corners.
      'GHANE|FOTA': [[196, 296]],
    },
  },
};
