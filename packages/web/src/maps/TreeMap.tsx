import { useMemo } from 'react';
import { Caps } from '../lib/i18n';
import { layoutNetwork } from './networkLayout';
import { MapHits } from './MapHits';

interface Props {
  edges: [string, string][];
  root: string;
  name: (code: string) => string;
  /** Colour for a connection; undefined uses the default line colour. */
  colourOf?: (a: string, b: string) => string | undefined;
  /** Colour for a station's tick; undefined uses the default. */
  tickColourOf?: (code: string) => string | undefined;
  /** Makes station names tappable. */
  onSelect?: (code: string, name: string) => void;
  label: string;
}

// One row per station, branches stepping right (see networkLayout), in the flat Beck style.
const WIDTH = 340;
const ROW = 34;
const TOP = 24;
const COL = 22;
const X0 = 16;
/** A line waiting this many rows to carry on (past branches) is drawn as a quiet dashed line. */
const LONG_WAIT = 6;

const x = (col: number) => X0 + col * COL;
const y = (row: number) => TOP + row * ROW;

/** Draws any network (a set of track connections) as a vertical schematic that fits a phone's width. */
export function TreeMap({ edges, root, name, colourOf, tickColourOf, onSelect, label }: Props) {
  const layout = useMemo(() => layoutNetwork(edges, root), [edges, root]);
  const placed = useMemo(() => new Map(layout.stations.map((s) => [s.code, s])), [layout]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const [a, b] of edges) for (const c of [a, b]) d.set(c, (d.get(c) ?? 0) + 1);
    return d;
  }, [edges]);
  const height = y(layout.rows - 1) + TOP;
  // Circles for ends of lines and junctions, ticks for the rest, as on the line maps.
  const major = (code: string) => (degree.get(code) ?? 0) !== 2;

  return (
    <nav className="line-map network__map" style={{ width: WIDTH, height }} aria-label={label}>
      <svg className="line-map__svg" width={WIDTH} height={height} aria-hidden>
        {layout.segments.map(({ from, to }) => {
          const p = placed.get(from)!;
          const c = placed.get(to)!;
          // Same column: straight down. Branch: the parent's line carries on, and the branch curves off
          // just above its first station.
          const d =
            c.col === p.col
              ? `M${x(p.col)},${y(p.row)} V${y(c.row)}`
              : `M${x(p.col)},${y(c.row) - ROW * 0.7} C${x(p.col)},${y(c.row) - ROW * 0.25} ${x(c.col)},${y(c.row) - ROW * 0.45} ${x(c.col)},${y(c.row)}`;
          const waiting = c.col === p.col && c.row - p.row > LONG_WAIT;
          const colour = waiting ? undefined : colourOf?.(from, to);
          return (
            <path
              key={`${from}|${to}`}
              d={d}
              className={`network__track${waiting ? ' network__track--waiting' : ''}`}
              style={colour ? { stroke: colour } : undefined}
            />
          );
        })}
        {layout.stations.map((s) =>
          major(s.code) ? (
            <circle key={s.code} cx={x(s.col)} cy={y(s.row)} r={7} className="line-map__dot" />
          ) : (
            <path
              key={s.code}
              d={`M${x(s.col)},${y(s.row)} h10`}
              className="network__tick"
              style={tickColourOf?.(s.code) ? { stroke: tickColourOf(s.code) } : undefined}
            />
          ),
        )}
      </svg>

      {layout.stations.map((s) => {
        const loop = layout.links.find((l) => l.from === s.code);
        const className = `network__label${major(s.code) ? ' network__label--major' : ''}`;
        const style = { top: y(s.row) - ROW / 2, left: x(s.col) + 16 };
        const content = (
          <>
            {/* One span for the name, so Irish prefixes (their own spans inside Caps) don't scatter in the flex label. */}
            <span>
              <Caps text={name(s.code)} />
            </span>
            {loop && <span className="network__loop"> ↔ {name(loop.to)}</span>}
          </>
        );
        return onSelect ? (
          <button key={s.code} className={className} style={style} onClick={() => onSelect(s.code, name(s.code))}>
            {content}
          </button>
        ) : (
          <span key={s.code} className={className} style={style}>
            {content}
          </span>
        );
      })}
      {onSelect && (
        <MapHits
          width={WIDTH}
          height={height}
          points={layout.stations.map((s) => ({
            code: s.code,
            x: x(s.col),
            y: y(s.row),
          }))}
          onSelect={(code) => onSelect(code, name(code))}
        />
      )}
    </nav>
  );
}
