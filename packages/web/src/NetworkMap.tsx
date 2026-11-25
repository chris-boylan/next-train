import { useMemo, useState } from 'react';
import { DART_LINE, findStationByCode } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import { NETWORK_EDGES, NETWORK_STATIONS, type NetworkStation } from './network.data';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  onBack: () => void;
}

// Stations sit at their real positions (lat/lon, corrected for latitude), joined by the track
// connections found from live trains, drawn in the same flat Beck style as the line maps.
const WIDTH = 1000;
const PAD = 40;
/** Extra room on the right for labels of the easternmost stations (Belfast, Rosslare). */
const PAD_RIGHT = 150;
const ZOOMS = [1, 2, 4, 8];

const dartPairs = new Set(
  DART_LINE.paths.flatMap((path) => path.slice(1).map((code, i) => [path[i]!, code].sort().join('|'))),
);

/** Every Irish Rail station on one schematic map. Not linked to live times yet. */
export function NetworkMap({ onBack }: Props) {
  const { t, lang } = useI18n();
  const [zoom, setZoom] = useState(0);
  const [selected, setSelected] = useState<NetworkStation>();
  const scale = ZOOMS[zoom]!;

  const { points, height, degree } = useMemo(() => {
    const lats = NETWORK_STATIONS.map((s) => s.lat);
    const lons = NETWORK_STATIONS.map((s) => s.lon);
    const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
    const unit = (WIDTH - PAD - PAD_RIGHT) / ((maxLon - minLon) * kx);
    const points = new Map(
      NETWORK_STATIONS.map((s) => [s.code, { x: PAD + (s.lon - minLon) * kx * unit, y: PAD + (maxLat - s.lat) * unit }]),
    );
    const degree = new Map<string, number>();
    for (const [a, b] of NETWORK_EDGES) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    return { points, height: PAD * 2 + (maxLat - minLat) * unit, degree };
  }, []);
  // DART connections are drawn last so other lines sharing the area don't cover them.
  const edges = useMemo(() => {
    const isDart = ([a, b]: [string, string]) => dartPairs.has([a, b].sort().join('|'));
    return [...NETWORK_EDGES.filter((e) => !isDart(e)), ...NETWORK_EDGES.filter(isDart)];
  }, []);

  const name = (s: NetworkStation) => {
    const known = findStationByCode(s.code);
    return lang === 'ga' && known?.irishName ? known.irishName : s.name;
  };
  // Labels appear as you zoom: ends of lines, then junctions, then every station.
  const labelled = (s: NetworkStation) => {
    const links = degree.get(s.code) ?? 0;
    return scale >= 4 || links === 1 || (scale >= 2 && links > 2);
  };
  // Text, dots and outlines keep a constant on-screen size whatever the zoom
  // (the map is about 0.36px per unit at 1× on a phone).
  const px = (pixels: number) => pixels / (0.36 * scale);
  const font = px(11);

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
        <div className="network__zoom" role="group" aria-label={t.zoom}>
          <button className="chip" onClick={() => setZoom(Math.max(0, zoom - 1))} disabled={zoom === 0} aria-label={t.zoomOut}>
            −
          </button>
          <span className="network__scale">{scale}×</span>
          <button
            className="chip"
            onClick={() => setZoom(Math.min(ZOOMS.length - 1, zoom + 1))}
            disabled={zoom === ZOOMS.length - 1}
            aria-label={t.zoomIn}
          >
            +
          </button>
        </div>
      </header>

      <div className="network__viewport">
        <svg
          className="network__svg"
          viewBox={`0 0 ${WIDTH} ${height}`}
          style={{ width: `${scale * 100}%` }}
          role="img"
          aria-label={t.allStations}
        >
          {edges.map(([a, b]) => {
            const p = points.get(a);
            const q = points.get(b);
            if (!p || !q) return null;
            const dart = dartPairs.has([a, b].sort().join('|'));
            return (
              <line
                key={`${a}|${b}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                className={`network__track${dart ? ' network__track--dart' : ''}`}
                strokeWidth={px(scale >= 4 ? 5 : 3)}
              />
            );
          })}
          {NETWORK_STATIONS.map((s) => {
            const p = points.get(s.code)!;
            const isSelected = selected?.code === s.code;
            return (
              <g key={s.code} className="network__station" onClick={() => setSelected(s)}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={px(isSelected ? 6 : 3.5)}
                  strokeWidth={px(1.5)}
                  className={`network__dot${isSelected ? ' network__dot--selected' : ''}${degree.has(s.code) ? '' : ' network__dot--unlinked'}`}
                />
                {/* Generous invisible tap target. */}
                <circle cx={p.x} cy={p.y} r={px(14)} fill="transparent" />
                {(labelled(s) || isSelected) && (
                  <text
                    x={p.x + px(6)}
                    y={p.y + font / 3}
                    fontSize={font}
                    strokeWidth={px(3)}
                    className="network__label"
                  >
                    {name(s)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="network__selected" aria-live="polite">
        {selected ? <Caps text={name(selected)} /> : t.tapStation}
      </p>
    </div>
  );
}
