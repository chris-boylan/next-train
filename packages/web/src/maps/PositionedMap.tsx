import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import type { LiveTrain } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import type { Schematic, SchematicPoint } from './data/schematics';
import { MapHits } from './MapHits';
import { alongPath, TrainMarkers } from './TrainMarkers';

interface Props {
  schematic: Schematic;
  edges: [string, string][];
  /** Stations to draw, in the order they're read (for screen readers). */
  codes: string[];
  name: (code: string) => string;
  /** Circles for ends of lines, junctions and turn-backs; ticks for the rest. */
  major: (code: string) => boolean;
  /** Colour for a connection; undefined uses the default line colour. Ticks take their line's colour. Track
   *  shared by several routes takes a list, drawn as stripes side by side. */
  colourOf?: (a: string, b: string) => string | string[] | undefined;
  favouriteCodes?: string[];
  currentCode?: string;
  /** Makes station names tappable. */
  onSelect?: (code: string) => void;
  /** Stations with no live times: named in italics. They're still tappable, so the caller can explain why. */
  noData?: (code: string) => boolean;
  /** Extra class for the map, e.g. for a smaller type size. */
  className?: string;
  label: string;
  /** Live trains to draw on the lines, when the viewer has turned them on. */
  trains?: LiveTrain[];
  onSelectTrain?: (train: LiveTrain) => void;
  /** Controls for a strip along the map's top edge, with the compass at its right (the live trains switch). */
  corner?: ReactNode;
}

const CORNER_RADIUS = 28;
/** The big stations, drawn larger with bolder names to draw the eye: Dublin's two termini, Belfast, the main
 *  city termini (Cork, Limerick, Galway, Waterford, Rosslare Europort) and Kilkenny; on the Luas, Heuston and
 *  Connolly, for their trains. */
export const INTERCHANGES: ReadonlySet<string> = new Set(['CNLLY', 'HSTON', 'BFSTC', 'CORK', 'LMRCK', 'GALWY', 'WFORD', 'RLEPT', 'KKNNY', 'LU_HEU', 'LU_CON']);
/** Matches .line-map__track's stroke-width. */
const TRACK_WIDTH = 10;
/** Each route's stripe on shared track, as on the tube map: track carrying several routes gets wider rather than
 *  splitting one track's width (four routes in 10 px were too thin to see). Two routes still fit 10 px. */
const STRIPE = 5;
/** How far a track reaches either side of its line, carrying `routes` routes. */
const halfWidth = (routes: number) => Math.max(TRACK_WIDTH, routes * STRIPE) / 2;

/** Shifts a line sideways by `by` (positive: to its left, travelling along it), keeping corners mitred. */
function offsetLine(points: [number, number][], by: number): [number, number][] {
  const normal = (a: [number, number], b: [number, number]): [number, number] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
  };
  return points.map((p, i) => {
    const before = i > 0 ? normal(points[i - 1]!, p) : undefined;
    const after = i < points.length - 1 ? normal(p, points[i + 1]!) : undefined;
    const n1 = before ?? after!;
    const n2 = after ?? before!;
    // At a corner, shift along the average of the two sides' normals, stretched so both sides keep the gap.
    const mx = n1[0] + n2[0];
    const my = n1[1] + n2[1];
    const scale = by / ((mx * n1[0] + my * n1[1]) || 1);
    return [p[0] + mx * scale, p[1] + my * scale];
  });
}

/** Like offsetLine, but each point has its own sideways shift (for easing a route in and out of a shared band). */
function offsetEach(points: [number, number][], by: number[]): [number, number][] {
  return points.map((p, i) => offsetLine(points, by[i]!)[i]!);
}

/** How far along a connection a route eases sideways into or out of its stripe in a shared band. */
const EASE_LENGTH = 18;

/**
 * A route's stripe along a connection, easing from `from` (its shift where it joins the last connection) to
 * `base` (its place on this one) and on to `to` at the far end, so lines drift into and out of shared bands
 * instead of stepping sideways at the station.
 */
function easedStripe(line: [number, number][], from: number, base: number, to: number): [number, number][] {
  if (from === base && to === base) return offsetLine(line, base);
  const lengths = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1]));
  const total = lengths.reduce((t, l) => t + l, 0);
  const ease = Math.min(EASE_LENGTH, total / 3);
  // Sample the stretches where the shift changes, so the drift is a curve, not a kink.
  const marks = new Set<number>([0, total]);
  for (let k = 1; k <= 6; k++) {
    if (from !== base) marks.add((ease * k) / 6);
    if (to !== base) marks.add(total - (ease * k) / 6);
  }
  const at = (d: number): [number, number] => {
    let left = d;
    for (let i = 0; i < lengths.length; i++) {
      const l = lengths[i]!;
      if (left <= l || i === lengths.length - 1) {
        const t = l ? Math.min(1, left / l) : 0;
        return [line[i]![0] + (line[i + 1]![0] - line[i]![0]) * t, line[i]![1] + (line[i + 1]![1] - line[i]![1]) * t];
      }
      left -= l;
    }
    return line.at(-1)!;
  };
  // Keep the corners: every original point, plus the sample points.
  const corners = line.slice(1, -1).map((_, i) => lengths.slice(0, i + 1).reduce((t, l) => t + l, 0));
  const ds = [...new Set([...marks, ...corners])].sort((x, y) => x - y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const shift = (d: number) =>
    d < ease ? from + (base - from) * smooth(d / ease) : d > total - ease ? base + (to - base) * smooth((d - (total - ease)) / ease) : base;
  return offsetEach(ds.map(at), ds.map(shift));
}

/** A line through `points`, with each corner replaced by a curve of up to CORNER_RADIUS. */
function roundedPath(points: [number, number][], radius = CORNER_RADIUS): string {
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const into = Math.hypot(cx - px, cy - py);
    const out = Math.hypot(nx - cx, ny - cy);
    // Never round further than halfway along either side, so curves don't overrun stations.
    const r = Math.min(radius, into / 2, out / 2);
    d += ` L${cx - ((cx - px) / into) * r},${cy - ((cy - py) / into) * r}`;
    d += ` Q${cx},${cy} ${cx + ((nx - cx) / out) * r},${cy + ((ny - cy) / out) * r}`;
  }
  const [lx, ly] = points.at(-1)!;
  return `${d} L${lx},${ly}`;
}

/** Ticks point towards the label. */
/** Ticks point towards the label, 7 px past the track's edge (wider where several routes share it). */
function tick(p: SchematicPoint, extra = 0): string {
  const length = 12 + extra;
  if (p.label === 'angled' || p.label === 'above') return `M${p.x},${p.y} v-${length}`;
  // A name under a station on a level line (Oranmore under Galway's stem): the tick points down to it.
  if (p.label === 'below' || p.label === 'angledBelow' || p.label === 'belowCentre') return `M${p.x},${p.y} v${length}`;
  if (p.label === 'left') return `M${p.x},${p.y} h-${length}`;
  return `M${p.x},${p.y} h${length}`;
}

/** `extra`: how much wider than a single track the track is here, so the name keeps its gap from the edge. */
function labelStyle(p: SchematicPoint, circle: boolean, mapMaxWidth?: number, extra = 0): CSSProperties {
  const style = placeLabel(p, circle, mapMaxWidth, extra);
  return p.labelDy ? { ...style, top: (style.top as number) + p.labelDy } : style;
}

function placeLabel(p: SchematicPoint, circle: boolean, mapMaxWidth?: number, extra = 0): CSSProperties {
  const dx = (p.labelDx ?? 0) + (p.label === 'left' ? -extra : p.label === 'right' || p.label === 'angled' ? extra : 0);
  const maxWidth = p.labelWidth ?? mapMaxWidth;
  switch (p.label) {
    case 'right':
      return { left: p.x + 14 + dx, top: p.y - 22, maxWidth };
    case 'left':
      // Anchored on its right edge, so it grows leftwards away from the line.
      return { right: `calc(100% - ${p.x - 14 + dx}px)`, top: p.y - 22, maxWidth, textAlign: 'right' };
    case 'below':
      return { left: p.x - 24 + dx, top: p.y + 12, maxWidth };
    case 'above':
      return { left: p.x - 24 + dx, top: p.y - 40, maxWidth };
    case 'angled':
      // Start clear of a full station circle; a tick needs less room.
      return circle ? { left: p.x + 10, top: p.y - 44 } : { left: p.x + 2, top: p.y - 30 };
    case 'angledBelow':
      return circle ? { left: p.x + 10, top: p.y + 16 } : { left: p.x + 2, top: p.y + 2 };
    case 'belowCentre': {
      const width = p.labelWidth ?? 48;
      return { left: p.x - width / 2 + dx, top: p.y + (circle ? 10 : 12), width, maxWidth: width, textAlign: 'center' };
    }
  }
}

/**
 * How much to shrink a map `width` px wide to fit the space it's in: 1 when it fits, less on a narrower screen
 * (maps are drawn 340 px wide; a 360 px phone has 328 px inside its gutters), so names at its right edge aren't cut
 * off. Applied as CSS zoom, which scales its layout too, so taps still land on the right station.
 */
function useFitScale(width: number) {
  const ref = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const fit = () => {
      const style = getComputedStyle(parent);
      const room = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setScale(room > 0 ? Math.min(1, room / width) : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [width]);
  return [ref, scale] as const;
}

/** A map drawn from hand-placed positions (see schematics.ts), with rounded corners, in the Beck style. */
export function PositionedMap({
  schematic,
  edges,
  codes,
  name,
  major,
  colourOf,
  favouriteCodes = [],
  currentCode,
  onSelect,
  noData = () => false,
  className = '',
  label,
  trains,
  onSelectTrain,
  corner,
}: Props) {
  const { t } = useI18n();
  const [mapRef, scale] = useFitScale(schematic.width);
  const { points, width, height, bends = {}, curves = {}, labelMaxWidth, oneWay = [], transfers = [] } = schematic;
  const curveOf = (a: string, b: string) => curves[`${a}|${b}`] ?? curves[`${b}|${a}`] ?? CORNER_RADIUS;
  const coloursOf = (a: string, b: string): (string | undefined)[] => {
    const c = colourOf?.(a, b);
    return Array.isArray(c) && c.length > 0 ? c : [typeof c === 'string' ? c : undefined];
  };
  // How much wider than one track the widest track at a station is (four Commuter routes through Pearse).
  const extraAt = (code: string) =>
    Math.max(0, ...edges.filter((e) => e.includes(code)).map(([a, b]) => halfWidth(coloursOf(a, b).length) - TRACK_WIDTH / 2));
  const tickStyle = (code: string) => {
    const edge = edges.find((e) => e.includes(code));
    const colour = edge && coloursOf(...edge)[0];
    return colour ? { stroke: colour } : undefined;
  };
  // A connection's full route: from, any corners (reversed if drawn the other way), to.
  const routeOf = (a: string, b: string): [number, number][] => {
    const corners = bends[`${a}|${b}`] ?? [...(bends[`${b}|${a}`] ?? [])].reverse();
    return [[points[a]!.x, points[a]!.y], ...corners, [points[b]!.x, points[b]!.y]];
  };
  // Each connection's stripes. Lines run top to bottom (then left to right) first, so each route's stripe stays on
  // the same side from one connection to the next.
  interface Lane {
    ordered: [number, number][];
    start: string;
    end: string;
    colours: (string | undefined)[];
    stripe: number;
    offsets: number[];
  }
  const lanes = new Map<string, Lane>();
  for (const [a, b] of edges) {
    const line = routeOf(a, b);
    const [first, last] = [line[0]!, line.at(-1)!];
    const forward = first[1] < last[1] || (first[1] === last[1] && first[0] < last[0]);
    const colours = coloursOf(a, b);
    const n = colours.length;
    const stripe = n === 1 ? TRACK_WIDTH : (halfWidth(n) * 2) / n;
    lanes.set(`${a}|${b}`, {
      ordered: forward ? line : [...line].reverse(),
      start: forward ? a : b,
      end: forward ? b : a,
      colours,
      stripe,
      offsets: colours.map((_, i) => (n === 1 ? 0 : (i - (n - 1) / 2) * stripe)),
    });
  }
  /** Where stripe `i` of `lane` meets the same route on the next connection at `node`, in this connection's frame,
   *  so both ease to the same point: the wider band's place. Its own place if the route ends here. */
  const meeting = (lane: Lane, i: number, node: string): number => {
    const own = lane.offsets[i]!;
    const colour = lane.colours[i];
    for (const [key, other] of lanes) {
      if (other === lane || (other.start !== node && other.end !== node)) continue;
      const j = other.colours.indexOf(colour);
      if (j < 0 || (lane.colours.length === 1 && other.colours.length === 1)) continue;
      // A band no wider than one track (two routes) already lines up with a lone route's edges: the lone route
      // stays centred and the band's stripes split off at the station (the Enterprise at Newry and Dundalk).
      if (lane.colours.length === 1 && halfWidth(other.colours.length) * 2 <= TRACK_WIDTH) return own;
      // Travelling on through the station keeps "left" the same side; two connections both leaving (or both
      // arriving at) the station flip it.
      const through = (lane.start === node) !== (other.start === node);
      const theirs = through ? other.offsets[j]! : -other.offsets[j]!;
      void key;
      // The wider band keeps its full width up to the station; the narrower line does the drifting (between two
      // bands of the same width, they meet halfway).
      if (lane.colours.length > other.colours.length) return own;
      if (lane.colours.length < other.colours.length) return theirs;
      return (own + theirs) / 2;
    }
    return own;
  };

  // A live train's way between two stations along the drawn track, corners included: through any stations an
  // express passes (Heuston to Kildare skips nine), and to a stand-in stop where one replaces the real station
  // on that link (the Nenagh line's Ballybrophy).
  const standIns = schematic.standIns ?? [];
  const trackBetween = (from: string, to: string): [number, number][] | undefined => {
    const swap = standIns.find((x) => [...x.link].sort().join('|') === [from, to].sort().join('|'));
    const a = swap && from === swap.for ? swap.code : from;
    const b = swap && to === swap.for ? swap.code : to;
    if (!points[a] || !points[b] || a === b) return undefined;
    const previous = new Map<string, string>([[a, a]]);
    const queue = [a];
    while (queue.length && !previous.has(b)) {
      const here = queue.shift()!;
      for (const [x, y] of edges) {
        const next = x === here ? y : y === here ? x : undefined;
        if (next && !previous.has(next)) {
          previous.set(next, here);
          queue.push(next);
        }
      }
    }
    if (!previous.has(b)) return undefined;
    const chain = [b];
    while (chain[0] !== a) chain.unshift(previous.get(chain[0]!)!);
    // A long way round isn't a skipped stop: draw it straight rather than across half the map.
    if (chain.length > 12) return undefined;
    return chain.slice(1).flatMap((code, i) => routeOf(chain[i]!, code).slice(i === 0 ? 0 : 1));
  };

  return (
    <nav
      ref={mapRef}
      className={`line-map schematic ${className}${corner ? ' line-map--with-bar' : ''}`}
      aria-label={label}
      // Zoomed, its own width already fits: max-width: 100% would clip it again.
      style={{ width, height, ...(scale < 1 && { zoom: scale, maxWidth: 'none' }) }}
    >
      {corner && (
        <div className="line-map__bar">
          <div className="line-map__bar-controls">{corner}</div>
          <span className="line-map__compass line-map__compass--bar" aria-hidden>
            {t.compassNorth} ↑
          </span>
        </div>
      )}
      <svg className="line-map__svg" width={width} height={height} aria-hidden>
        {!corner && (
          <text x={width - 14} y={18} textAnchor="end" className="line-map__compass">
            {t.compassNorth} ↑
          </text>
        )}
        {edges.flatMap(([a, b]) => {
          const lane = lanes.get(`${a}|${b}`)!;
          // Every connection is drawn as stripes, one per route (a single route is one full-width stripe), each
          // eased into its neighbours' stripes at the stations either end so shared bands join smoothly.
          // Under a shared band, the band's full width in its middle route's colour, so no white shows between the
          // stripes where they bend (each stripe's corner is drawn on its own, so they don't nest exactly).
          const underlay =
            lane.colours.length > 1 ? (
              <path
                key={`${a}|${b}|under`}
                d={roundedPath(lane.ordered, curveOf(a, b))}
                className="line-map__track"
                style={{
                  strokeWidth: lane.stripe * lane.colours.length,
                  ...(lane.colours[Math.floor(lane.colours.length / 2)] ? { stroke: lane.colours[Math.floor(lane.colours.length / 2)] } : {}),
                }}
              />
            ) : null;
          return [underlay, ...lane.colours.map((colour, i) => {
            const [from, to] = [meeting(lane, i, lane.start), meeting(lane, i, lane.end)];
            return (
              <path
                key={`${a}|${b}|${i}`}
                d={roundedPath(easedStripe(lane.ordered, from, lane.offsets[i]!, to), curveOf(a, b))}
                className="line-map__track"
                style={{
                  ...(lane.colours.length > 1 && { strokeWidth: lane.stripe + 0.5, strokeLinejoin: 'round' as const }),
                  ...(colour ? { stroke: colour } : {}),
                }}
              />
            );
          })];
        })}
        {/* One-way track: an arrow halfway along, in the page's colour, pointing the way trains go. */}
        {oneWay
          .filter(([a, b]) => points[a] && points[b])
          .map(([a, b]) => {
            const at = alongPath(routeOf(a, b), 0.5);
            const angle = (Math.atan2(at.dy, at.dx) * 180) / Math.PI;
            return (
              <path
                key={`${a}>${b}`}
                d="M-2.5,-3.5 L1.5,0 L-2.5,3.5"
                className="line-map__arrow"
                transform={`translate(${at.x} ${at.y}) rotate(${angle})`}
              />
            );
          })}
        {/* Changing line on foot: dashed, under the stations' circles. */}
        {transfers
          .filter(({ from, to }) => points[from] && points[to])
          .map(({ from, to, via = [] }) => {
            const line: [number, number][] = [[points[from]!.x, points[from]!.y], ...via, [points[to]!.x, points[to]!.y]];
            return <path key={`${from}~${to}`} d={`M${line.map(([x, y]) => `${x},${y}`).join(' L')}`} className="line-map__transfer" />;
          })}
        {codes.map((code) => {
          const p = points[code]!;
          const hub = INTERCHANGES.has(code);
          return hub || major(code) || code === currentCode ? (
            <circle
              key={code}
              cx={p.x}
              cy={p.y}
              // Big enough to cover a wide shared track.
              r={Math.max(hub ? 12 : 9, extraAt(code) + TRACK_WIDTH / 2 + 4)}
              className={`line-map__dot${hub ? ' line-map__dot--hub' : ''}${code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={code} d={tick(p, extraAt(code))} className="line-map__tick" style={tickStyle(code)} />
          );
        })}
      </svg>

      {codes.map((code) => {
        const p = points[code]!;
        const favourite = favouriteCodes.includes(code);
        const className = `schematic__stop schematic__stop--${p.label}${labelMaxWidth ? ' schematic__stop--wrap' : ''}${major(code) || INTERCHANGES.has(code) ? ' line-map__stop--major' : ''}${INTERCHANGES.has(code) ? ` schematic__stop--hub${p.smallHubLabel ? ' schematic__stop--hub-small' : ''}` : ''}${p.boldLabel ? ' schematic__stop--bold' : ''}${code === currentCode ? ' line-map__stop--current' : ''}${noData(code) ? ' schematic__stop--no-data' : ''}`;
        const content = (
          <>
            {/* One span for the whole name: Caps puts Irish prefixes in their own spans, which the flex
                label would otherwise lay out as separate, scattered pieces. */}
            <span className="schematic__name">
              <Caps text={name(code)} />
            </span>
            {favourite && <span className="line-map__fav">★</span>}
          </>
        );
        return onSelect ? (
          <button
            key={code}
            className={className}
            style={labelStyle(p, major(code) || code === currentCode, labelMaxWidth, extraAt(code))}
            onClick={() => onSelect(code)}
            aria-label={`${name(code)}${noData(code) ? `, ${t.timetableOnly}` : ''}${favourite ? `, ${t.favourite}` : ''}`}
          >
            {content}
          </button>
        ) : (
          <span key={code} className={className} style={labelStyle(p, major(code) || code === currentCode, labelMaxWidth, extraAt(code))}>
            {content}
          </span>
        );
      })}
      {onSelect && (
        <MapHits
          width={width}
          height={height}
          points={codes.map((code) => ({ code, ...points[code]! }))}
          onSelect={onSelect}
        />
      )}
      {trains && (
        <TrainMarkers
          trains={trains}
          pointOf={(code) => points[code]}
          // Along the drawn line, corners included, where the two stations are neighbours on the map.
          pathOf={trackBetween}
          orientation="track"
          onSelect={(train) => onSelectTrain?.(train)}
        />
      )}
    </nav>
  );
}
