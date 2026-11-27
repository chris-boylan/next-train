import { findStationByCode, type LiveTrain } from '@dart-times/core';
import { useI18n } from '../lib/i18n';

interface Point {
  x: number;
  y: number;
}

type Path = [number, number][];

/** How trains point: straight up or down (north–south maps), or along the track to the nearest 45° (maps whose
 *  lines also run east–west, like Cork's along the harbour). */
export type TrainOrientation = 'vertical' | 'track';

interface Props {
  trains: LiveTrain[];
  /** Where a station is drawn on this map; undefined for stations the map doesn't show. */
  pointOf: (code: string) => Point | undefined;
  /** The drawn line between two neighbouring stations, corners included, when it isn't straight. */
  pathOf?: (from: string, to: string) => Path | undefined;
  orientation?: TrainOrientation;
  onSelect: (train: LiveTrain) => void;
}

/** How far a marker sits from the middle of the track, on the left of its direction of travel (Irish trains keep
 *  left): enough to split two trains passing, small enough to stay on the track and clear of station names. */
const SIDE_OFFSET = 6;
/** Gap between trains drawn at the same spot in the same direction. */
const STACK_GAP = 14;

interface Placed {
  train: LiveTrain;
  x: number;
  y: number;
  /** Degrees clockwise from pointing up. */
  angle: number;
}

/** The point `fraction` of the way along a path, and the direction of the stretch it's on. */
export function alongPath(path: Path, fraction: number): { x: number; y: number; dx: number; dy: number } {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  let left = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < lengths.length; i++) {
    const [ax, ay] = path[i]!;
    const [bx, by] = path[i + 1]!;
    const l = lengths[i]!;
    // At an exact station (fraction 0) use the first stretch, so a standing train faces where it's going.
    if (left <= l || i === lengths.length - 1) {
      const t = l > 0 ? Math.min(1, left / l) : 0;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: bx - ax, dy: by - ay };
    }
    left -= l;
  }
  const [x, y] = path[0]!;
  return { x, y, dx: 0, dy: 0 };
}

/** Puts each train between (or at) its stations, nudged to its side of the track. */
export function placeTrains(
  trains: LiveTrain[],
  pointOf: Props['pointOf'],
  pathOf: Props['pathOf'] = () => undefined,
  orientation: TrainOrientation = 'vertical',
): Placed[] {
  const placed: Placed[] = [];
  const stacks = new Map<string, number>();
  for (const train of trains) {
    const fromCode = train.at ?? train.from ?? train.to;
    const to = pointOf(train.to);
    const start = pointOf(fromCode);
    if (!to || !start) continue;
    const path: Path = pathOf(fromCode, train.to) ?? [[start.x, start.y], [to.x, to.y]];
    const here = alongPath(path, train.at ? 0 : train.progress);

    // Which way it's pointing: north/south on a north–south map, else along the track, to the nearest 45°.
    let angle: number;
    if (orientation === 'vertical' || Math.hypot(here.dx, here.dy) < 1) {
      angle = train.direction === 'Northbound' ? 0 : 180;
    } else {
      const raw = (Math.atan2(here.dx, -here.dy) * 180) / Math.PI;
      angle = ((Math.round(raw / 45) * 45) % 360 + 360) % 360;
    }
    const rad = (angle * Math.PI) / 180;
    const [ux, uy] = [Math.sin(rad), -Math.cos(rad)];
    // Left of travel, in screen coordinates (y down).
    const [nx, ny] = [uy, -ux];

    const key = `${Math.round(here.x / 4)},${Math.round(here.y / 4)},${train.direction}`;
    const stack = stacks.get(key) ?? 0;
    stacks.set(key, stack + 1);

    placed.push({
      train,
      x: here.x + nx * SIDE_OFFSET - ux * stack * STACK_GAP,
      y: here.y + ny * SIDE_OFFSET - uy * stack * STACK_GAP,
      angle,
    });
  }
  return placed;
}

/** Live trains drawn over a map as small tappable arrows that glide to their new place on each refresh. */
export function TrainMarkers({ trains, pointOf, pathOf, orientation, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const nameOf = (code: string | undefined, fallback: string) => {
    const station = code ? findStationByCode(code) : undefined;
    return station ? stationName(station) : fallback;
  };

  return (
    <div className="train-markers">
      {placeTrains(trains, pointOf, pathOf, orientation).map(({ train, x, y, angle }) => (
        <button
          key={train.code}
          // Not tracked, placed from the timetable: hollow, like the station page's timetabled trains.
          className={`train-marker train-marker--${train.direction === 'Northbound' ? 'north' : 'south'}${train.estimated ? ' train-marker--estimated' : ''}`}
          style={{ transform: `translate(${x}px, ${y}px)` }}
          onClick={() => onSelect(train)}
          aria-label={
            train.estimated
              ? t.describeEstimated(nameOf(train.destinationCode, train.destination), nameOf(train.to, train.to))
              : t.describeTrain(nameOf(train.destinationCode, train.destination), nameOf(train.to, train.to), train.lateMins)
          }
        >
          <TrainTopGlyph angle={angle} />
        </button>
      ))}
    </div>
  );
}

/** A DART from above, nose up (before rotating): the station page's train, in the same flat colours, with its
 *  windscreen and headlights at the front so you can tell which way it's going. */
function TrainTopGlyph({ angle }: { angle: number }) {
  return (
    <svg width="16" height="28" viewBox="0 0 16 28" aria-hidden style={{ transform: `rotate(${angle}deg)` }}>
      <rect x="1.5" y="1.5" width="13" height="25" rx="3" className="glyph-body train-marker__body" />
      <rect x="4" y="5.5" width="8" height="4" className="glyph-window" />
      <rect x="3.5" y="2.5" width="3" height="2" className="glyph-light" />
      <rect x="9.5" y="2.5" width="3" height="2" className="glyph-light" />
    </svg>
  );
}
