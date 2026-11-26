import type { CSSProperties } from 'react';
import { Caps, useI18n } from './i18n';
import type { Schematic, SchematicPoint } from './schematics';

interface Props {
  schematic: Schematic;
  edges: [string, string][];
  /** Stations to draw, in the order they're read (for screen readers). */
  codes: string[];
  name: (code: string) => string;
  /** Circles for ends of lines, junctions and turn-backs; ticks for the rest. */
  major: (code: string) => boolean;
  /** Colour for a connection; undefined uses the default line colour. Ticks take their line's colour. */
  colourOf?: (a: string, b: string) => string | undefined;
  favouriteCodes?: string[];
  currentCode?: string;
  /** Makes station names tappable. */
  onSelect?: (code: string) => void;
  label: string;
}

const CORNER_RADIUS = 28;

/** A line through `points`, with each corner replaced by a curve of up to CORNER_RADIUS. */
function roundedPath(points: [number, number][]): string {
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [cx, cy] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const into = Math.hypot(cx - px, cy - py);
    const out = Math.hypot(nx - cx, ny - cy);
    // Never round further than halfway along either side, so curves don't overrun stations.
    const r = Math.min(CORNER_RADIUS, into / 2, out / 2);
    d += ` L${cx - ((cx - px) / into) * r},${cy - ((cy - py) / into) * r}`;
    d += ` Q${cx},${cy} ${cx + ((nx - cx) / out) * r},${cy + ((ny - cy) / out) * r}`;
  }
  const [lx, ly] = points.at(-1)!;
  return `${d} L${lx},${ly}`;
}

/** Ticks point towards the label. */
function tick(p: SchematicPoint): string {
  if (p.label === 'angled') return `M${p.x},${p.y} v-12`;
  if (p.label === 'left') return `M${p.x},${p.y} h-12`;
  return `M${p.x},${p.y} h12`;
}

function labelStyle(p: SchematicPoint, maxWidth?: number): CSSProperties {
  switch (p.label) {
    case 'right':
      return { left: p.x + 14, top: p.y - 22, maxWidth };
    case 'left':
      // Anchored on its right edge, so it grows leftwards away from the line.
      return { right: `calc(100% - ${p.x - 14}px)`, top: p.y - 22, maxWidth, textAlign: 'right' };
    case 'below':
      return { left: p.x - 24, top: p.y + 12, maxWidth };
    case 'angled':
      return { left: p.x + 2, top: p.y - 30 };
  }
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
  label,
}: Props) {
  const { t } = useI18n();
  const { points, width, height, bends = {}, labelMaxWidth } = schematic;
  const tickStyle = (code: string) => {
    const edge = edges.find((e) => e.includes(code));
    const colour = edge && colourOf?.(...edge);
    return colour ? { stroke: colour } : undefined;
  };
  // A connection's full route: from, any corners (reversed if drawn the other way), to.
  const routeOf = (a: string, b: string): [number, number][] => {
    const corners = bends[`${a}|${b}`] ?? [...(bends[`${b}|${a}`] ?? [])].reverse();
    return [[points[a]!.x, points[a]!.y], ...corners, [points[b]!.x, points[b]!.y]];
  };

  return (
    <nav className="line-map schematic" aria-label={label} style={{ width, height }}>
      <svg className="line-map__svg" width={width} height={height} aria-hidden>
        <text x={width - 14} y={18} textAnchor="end" className="line-map__compass">
          {t.compassNorth} ↑
        </text>
        {edges.map(([a, b]) => {
          const colour = colourOf?.(a, b);
          return (
            <path
              key={`${a}|${b}`}
              d={roundedPath(routeOf(a, b))}
              className="line-map__track"
              style={colour ? { stroke: colour } : undefined}
            />
          );
        })}
        {codes.map((code) => {
          const p = points[code]!;
          return major(code) || code === currentCode ? (
            <circle
              key={code}
              cx={p.x}
              cy={p.y}
              r={9}
              className={`line-map__dot${code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={code} d={tick(p)} className="line-map__tick" style={tickStyle(code)} />
          );
        })}
      </svg>

      {codes.map((code) => {
        const p = points[code]!;
        const favourite = favouriteCodes.includes(code);
        const className = `schematic__stop schematic__stop--${p.label}${labelMaxWidth ? ' schematic__stop--wrap' : ''}${major(code) ? ' line-map__stop--major' : ''}${code === currentCode ? ' line-map__stop--current' : ''}`;
        const content = (
          <>
            <Caps text={name(code)} />
            {favourite && <span className="line-map__fav">★</span>}
          </>
        );
        return onSelect ? (
          <button
            key={code}
            className={className}
            style={labelStyle(p, labelMaxWidth)}
            onClick={() => onSelect(code)}
            aria-label={`${name(code)}${favourite ? `, ${t.favourite}` : ''}`}
          >
            {content}
          </button>
        ) : (
          <span key={code} className={className} style={labelStyle(p, labelMaxWidth)}>
            {content}
          </span>
        );
      })}
    </nav>
  );
}
