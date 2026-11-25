import { useMemo } from 'react';
import { DART_LINE, findStationByCode } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import { NETWORK_EDGES, NETWORK_STATIONS } from './network.data';
import { layoutNetwork } from './networkLayout';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  onBack: () => void;
  onSelectStation: (code: string, name: string) => void;
}

// Same flat Beck style as the line maps: one row per station, branches step right (see networkLayout).
const WIDTH = 340;
const ROW = 34;
const TOP = 24;
const COL = 22;
const X0 = 16;
const ROOT = 'CNLLY';
/** A line waiting this many rows to carry on (past branches) is drawn as a quiet dashed line. */
const LONG_WAIT = 6;

const x = (col: number) => X0 + col * COL;
const y = (row: number) => TOP + row * ROW;
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
const dartPairs = new Set(DART_LINE.paths.flatMap((path) => path.slice(1).map((code, i) => pairKey(path[i]!, code))));
const dartStations = new Set(DART_LINE.paths.flat());
const rawNames = new Map(NETWORK_STATIONS.map((s) => [s.code, s.name]));

/** Every Irish Rail station as one schematic, fitting the screen's width and scrolling down. Not linked to live times yet. */
export function NetworkMap({ onBack, onSelectStation }: Props) {
  const { t, lang } = useI18n();
  const layout = useMemo(() => layoutNetwork(NETWORK_EDGES, ROOT), []);
  const placed = useMemo(() => new Map(layout.stations.map((s) => [s.code, s])), [layout]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const [a, b] of NETWORK_EDGES) for (const c of [a, b]) d.set(c, (d.get(c) ?? 0) + 1);
    return d;
  }, []);
  const unmapped = NETWORK_STATIONS.filter((s) => !placed.has(s.code));
  const height = y(layout.rows - 1) + TOP;

  const name = (code: string) => {
    const known = findStationByCode(code);
    if (known) return lang === 'ga' && known.irishName ? known.irishName : known.name;
    const raw = rawNames.get(code) ?? code;
    // A few API names are all capitals; show them like the rest.
    return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
  };
  // Circles for ends of lines and junctions, ticks for the rest, as on the line maps.
  const major = (code: string) => (degree.get(code) ?? 0) !== 2;

  return (
    <div className="network">
      <header className="picker__header">
        <div className="picker__title">
          <button className="chip" onClick={onBack}>
            ‹ {t.services}
          </button>
          <OptionsMenu />
        </div>
        <h1 className="picker__service">{t.allStations}</h1>
      </header>

      <nav className="line-map network__map" style={{ width: WIDTH, height }} aria-label={t.allStations}>
        <svg className="line-map__svg" width={WIDTH} height={height} aria-hidden>
          {layout.segments.map(({ from, to }) => {
            const p = placed.get(from)!;
            const c = placed.get(to)!;
            // Same column: straight down. Branch: the parent's line carries on, and the branch
            // leaves it just above its first station.
            const d =
              c.col === p.col
                ? `M${x(p.col)},${y(p.row)} V${y(c.row)}`
                : `M${x(p.col)},${y(c.row) - ROW * 0.7} L${x(c.col)},${y(c.row)}`;
            const waiting = c.col === p.col && c.row - p.row > LONG_WAIT;
            const kind = waiting ? ' network__track--waiting' : dartPairs.has(pairKey(from, to)) ? ' network__track--dart' : '';
            return <path key={`${from}|${to}`} d={d} className={`network__track${kind}`} />;
          })}
          {layout.stations.map((s) =>
            major(s.code) ? (
              <circle key={s.code} cx={x(s.col)} cy={y(s.row)} r={7} className="line-map__dot" />
            ) : (
              <path
                key={s.code}
                d={`M${x(s.col)},${y(s.row)} h10`}
                className={`network__tick${dartStations.has(s.code) ? ' network__tick--dart' : ''}`}
              />
            ),
          )}
        </svg>

        {layout.stations.map((s) => {
          const loop = layout.links.find((l) => l.from === s.code);
          return (
            <button
              key={s.code}
              className={`network__label${major(s.code) ? ' network__label--major' : ''}`}
              style={{ top: y(s.row) - ROW / 2, left: x(s.col) + 16 }}
              onClick={() => onSelectStation(s.code, name(s.code))}
            >
              <Caps text={name(s.code)} />
              {loop && <span className="network__loop"> ↔ {name(loop.to)}</span>}
            </button>
          );
        })}
      </nav>

      {unmapped.length > 0 && (
        <p className="network__unmapped">
          {t.notYetMapped}: {unmapped.map((s) => name(s.code)).join(', ')}
        </p>
      )}
    </div>
  );
}
