import type { CSSProperties } from 'react';
import type { Service } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import type { Schematic, SchematicPoint } from './schematics';

interface Props {
  service: Service;
  schematic: Schematic;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

/** Ticks point towards the label: up for angled labels over a horizontal line, right otherwise. */
const tick = (p: SchematicPoint) => (p.label === 'angled' ? `M${p.x},${p.y} v-12` : `M${p.x},${p.y} h12`);

/** A service map drawn from hand-placed positions (see schematics.ts), in the same style as the other maps. */
export function SchematicMap({ service, schematic, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const { points, width, height } = schematic;
  const { paths, termini } = service.line;

  const unique = new Map<string, [string, string]>();
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) unique.set([path[i - 1]!, path[i]!].sort().join('|'), [path[i - 1]!, path[i]!]);
  }
  const degree = new Map<string, number>();
  for (const [a, b] of unique.values()) for (const c of [a, b]) degree.set(c, (degree.get(c) ?? 0) + 1);
  // Circles for ends of lines, junctions and turn-backs (e.g. Cork); ticks for the rest.
  const major = (code: string) =>
    degree.get(code) !== 2 || termini.Northbound.includes(code) || termini.Southbound.includes(code);

  return (
    <nav className="line-map schematic" aria-label={t.mapLabel} style={{ width, height }}>
      <svg className="line-map__svg" width={width} height={height} aria-hidden>
        <text x={width - 14} y={18} textAnchor="end" className="line-map__compass">
          {t.compassNorth} ↑
        </text>
        {[...unique.values()].map(([a, b]) => (
          <path
            key={`${a}|${b}`}
            d={`M${points[a]!.x},${points[a]!.y} L${points[b]!.x},${points[b]!.y}`}
            className="line-map__track"
          />
        ))}
        {service.stations.map((s) => {
          const p = points[s.code]!;
          return major(s.code) || s.code === currentCode ? (
            <circle
              key={s.code}
              cx={p.x}
              cy={p.y}
              r={9}
              className={`line-map__dot${s.code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={s.code} d={tick(p)} className="line-map__tick" />
          );
        })}
      </svg>

      {service.stations.map((s) => {
        const p = points[s.code]!;
        const favourite = favouriteCodes.includes(s.code);
        const style: CSSProperties =
          p.label === 'right'
            ? { left: p.x + 14, top: p.y - 22 }
            : p.label === 'below'
              ? { left: p.x - 24, top: p.y + 12 }
              : { left: p.x + 2, top: p.y - 30 };
        return (
          <button
            key={s.code}
            className={`schematic__stop schematic__stop--${p.label}${major(s.code) ? ' line-map__stop--major' : ''}${s.code === currentCode ? ' line-map__stop--current' : ''}`}
            style={style}
            onClick={() => onSelect(s.code)}
            aria-label={`${stationName(s, true)}${favourite ? `, ${t.favourite}` : ''}`}
          >
            <Caps text={stationName(s)} />
            {favourite && <span className="line-map__fav">★</span>}
          </button>
        );
      })}
    </nav>
  );
}
