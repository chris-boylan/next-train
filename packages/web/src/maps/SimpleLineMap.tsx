import type { CSSProperties, ReactNode } from 'react';
import type { LiveTrain, Service } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { MapHits } from './MapHits';
import { TrainMarkers } from './TrainMarkers';

interface Props {
  service: Service;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
  /** Live trains to draw on the line, when the viewer has turned them on. */
  trains?: LiveTrain[];
  onSelectTrain?: (train: LiveTrain) => void;
  /** Controls for a strip along the map's top edge, with the compass at its right (the live trains switch). */
  corner?: ReactNode;
}

// A single straight line, north at the top, in the same Beck style as the DART map.
const ROW = 64;
const TOP = 30;
const WIDTH = 360;
const X = 120;

/** Schematic map for a service with one line and no branches (the Enterprise). */
export function SimpleLineMap({ service, favouriteCodes, currentCode, onSelect, trains, onSelectTrain, corner }: Props) {
  const { t, stationName } = useI18n();
  const stations = service.stations;
  const y = (i: number) => TOP + i * ROW;
  const height = y(stations.length - 1) + TOP;
  const ends = new Set([stations[0]!.code, stations.at(-1)!.code]);
  const points = stations.map((s, i) => ({ code: s.code, x: X, y: y(i) }));
  const pointOf = (code: string) => points.find((p) => p.code === code);

  return (
    <nav className={`line-map${corner ? ' line-map--with-bar' : ''}`} aria-label={t.mapLabel} style={{ width: WIDTH, height }}>
      {corner && (
        <div className="line-map__bar">
          <div className="line-map__bar-controls">{corner}</div>
          <span className="line-map__compass line-map__compass--bar" aria-hidden>
            {t.compassNorth} ↑
          </span>
        </div>
      )}
      <svg className="line-map__svg" width={WIDTH} height={height} aria-hidden>
        {!corner && (
          <text x={WIDTH - 14} y={18} textAnchor="end" className="line-map__compass">
            {t.compassNorth} ↑
          </text>
        )}
        <path d={`M${X},${y(0)} V${y(stations.length - 1)}`} className="line-map__track" />
        {stations.map((s, i) =>
          ends.has(s.code) || s.code === currentCode ? (
            <circle
              key={s.code}
              cx={X}
              cy={y(i)}
              r={9}
              className={`line-map__dot${s.code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={s.code} d={`M${X},${y(i)} h12`} className="line-map__tick" />
          ),
        )}
      </svg>

      {stations.map((s, i) => {
        const favourite = favouriteCodes.includes(s.code);
        const style: CSSProperties = { top: y(i) - 22, left: X - 16, right: 0 };
        return (
          <button
            key={s.code}
            className={`line-map__stop line-map__stop--trunk${s.code === currentCode ? ' line-map__stop--current' : ''}${ends.has(s.code) ? ' line-map__stop--major' : ''}`}
            style={style}
            onClick={() => onSelect(s.code)}
            aria-label={`${stationName(s, true)}${favourite ? `, ${t.favourite}` : ''}`}
          >
            <span className="line-map__name">
              <Caps text={stationName(s)} />
            </span>
            {favourite && <span className="line-map__fav">★</span>}
          </button>
        );
      })}
      <MapHits
        width={WIDTH}
        height={height}
        points={points}
        onSelect={onSelect}
      />
      {trains && <TrainMarkers trains={trains} pointOf={pointOf} onSelect={(train) => onSelectTrain?.(train)} />}
    </nav>
  );
}
