import type { Service } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import { layoutNetwork } from './networkLayout';

interface Props {
  service: Service;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

// Same flat Beck style as the other maps; laid out from the line's own paths by networkLayout, so any
// branching service (Cork today, Dublin Commuter or InterCity later) gets a map without hand-drawing.
const WIDTH = 340;
const ROW = 44;
const TOP = 30;
const COL = 34;
const X0 = 90;

const x = (col: number) => X0 + col * COL;
const y = (row: number) => TOP + row * ROW;

/** Schematic map for a service whose line branches, drawn from the northern end down. */
export function BranchLineMap({ service, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const { paths, termini } = service.line;
  // Paths share track (Cork–Glounthaune is on both Cork routes), so keep each connection once.
  const unique = new Map<string, [string, string]>();
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) unique.set([path[i - 1]!, path[i]!].sort().join('|'), [path[i - 1]!, path[i]!]);
  }
  const edges = [...unique.values()];
  // Every path ends at the same northern station (e.g. Mallow), so start the map there.
  const layout = layoutNetwork(edges, paths[0]!.at(-1)!);
  const placed = new Map(layout.stations.map((s) => [s.code, s]));
  const degree = new Map<string, number>();
  for (const [a, b] of edges) for (const c of [a, b]) degree.set(c, (degree.get(c) ?? 0) + 1);
  // Circles for ends of lines, junctions and turn-backs (e.g. Cork), as Bray is on the DART map.
  const ends = new Set([
    ...layout.stations.filter((s) => degree.get(s.code) !== 2).map((s) => s.code),
    ...termini.Northbound,
    ...termini.Southbound,
  ]);
  const height = y(layout.rows - 1) + TOP;

  return (
    <nav className="line-map" aria-label={t.mapLabel} style={{ width: WIDTH, height }}>
      <svg className="line-map__svg" width={WIDTH} height={height} aria-hidden>
        <text x={WIDTH - 14} y={18} textAnchor="end" className="line-map__compass">
          {t.compassNorth} ↑
        </text>
        {layout.segments.map(({ from, to }) => {
          const p = placed.get(from)!;
          const c = placed.get(to)!;
          const d =
            c.col === p.col
              ? `M${x(p.col)},${y(p.row)} V${y(c.row)}`
              : `M${x(p.col)},${y(c.row) - ROW * 0.7} C${x(p.col)},${y(c.row) - ROW * 0.25} ${x(c.col)},${y(c.row) - ROW * 0.45} ${x(c.col)},${y(c.row)}`;
          return <path key={`${from}|${to}`} d={d} className="line-map__track" />;
        })}
        {layout.stations.map((s) =>
          ends.has(s.code) || s.code === currentCode ? (
            <circle
              key={s.code}
              cx={x(s.col)}
              cy={y(s.row)}
              r={9}
              className={`line-map__dot${s.code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={s.code} d={`M${x(s.col)},${y(s.row)} h12`} className="line-map__tick" />
          ),
        )}
      </svg>

      {layout.stations.map((s) => {
        const station = service.stations.find((st) => st.code === s.code)!;
        const favourite = favouriteCodes.includes(s.code);
        return (
          <button
            key={s.code}
            className={`line-map__stop line-map__stop--trunk${s.code === currentCode ? ' line-map__stop--current' : ''}${ends.has(s.code) ? ' line-map__stop--major' : ''}`}
            style={{ top: y(s.row) - ROW / 2, left: x(s.col) - 16, right: 0 }}
            onClick={() => onSelect(s.code)}
            aria-label={`${stationName(station, true)}${favourite ? `, ${t.favourite}` : ''}`}
          >
            <span className="line-map__name">
              <Caps text={stationName(station)} />
            </span>
            {favourite && <span className="line-map__fav">★</span>}
          </button>
        );
      })}
    </nav>
  );
}
