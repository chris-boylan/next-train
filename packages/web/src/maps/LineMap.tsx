import type { CSSProperties, ReactNode } from 'react';
import { BRANCHES, findStationByCode, JUNCTION, type LiveTrain, TRUNK } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { MapHits } from './MapHits';
import { INTERCHANGES } from './PositionedMap';
import { TrainMarkers } from './TrainMarkers';

interface Props {
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
  /** Live trains to draw on the line, when the viewer has turned them on. */
  trains?: LiveTrain[];
  onSelectTrain?: (train: LiveTrain) => void;
  /** Controls for a strip along the map's top edge, with the compass at its right (the live trains switch). */
  corner?: ReactNode;
}

// Schematic geometry (px). North is up; the Malahide branch is drawn west (left) of the Howth branch.
const ROW = 44;
const TOP = 30;
const WIDTH = 360;
const X = { malahide: 110, trunk: 160, howth: 210 } as const;
const CITY_CENTRE = ['CNLLY', 'TARA', 'PERSE', 'GCDK'];

type Side = 'malahide' | 'trunk' | 'howth';
interface Point {
  code: string;
  x: number;
  y: number;
  side: Side;
}

const rowY = (row: number) => TOP + row * ROW;
const branchRows = BRANCHES.malahide.length; // both branches have 3 stations

// Branch ends at the top, the junction below them, then the trunk south to Greystones.
const POINTS: Point[] = [
  ...[...BRANCHES.malahide].reverse().map((code, row) => ({ code, x: X.malahide, y: rowY(row), side: 'malahide' as const })),
  ...[...BRANCHES.howth].reverse().map((code, row) => ({ code, x: X.howth, y: rowY(row), side: 'howth' as const })),
  ...[...TRUNK].reverse().map((code, i) => ({ code, x: X.trunk, y: rowY(branchRows + i), side: 'trunk' as const })),
];

const POINT_BY_CODE = new Map(POINTS.map((p) => [p.code, p]));
const pointOf = (code: string) => POINT_BY_CODE.get(code);

const HEIGHT = Math.max(...POINTS.map((p) => p.y)) + TOP;
const junctionY = rowY(branchRows);
const lastBranchY = rowY(branchRows - 1);
// Termini, the junction, and Bray (where many trains turn back) get bigger dots and bold names.
const ENDS = new Set<string>([BRANCHES.malahide.at(-1)!, BRANCHES.howth.at(-1)!, TRUNK[0], JUNCTION, 'BRAY']);

// Connolly, where the DART meets the Commuter, Enterprise and InterCity lines and the Luas, gets the bigger
// interchange ring and a larger name, as on the other maps.
const isHub = (code: string) => INTERCHANGES.has(code);

const branchPath = (x: number) =>
  `M${x},${rowY(0)} V${lastBranchY} C${x},${lastBranchY + ROW * 0.6} ${X.trunk},${junctionY - ROW * 0.6} ${X.trunk},${junctionY}`;

const cityTop = Math.min(...POINTS.filter((p) => CITY_CENTRE.includes(p.code)).map((p) => p.y));
const cityBottom = Math.max(...POINTS.filter((p) => CITY_CENTRE.includes(p.code)).map((p) => p.y));

/** The DART network as a tappable schematic map. */
export function LineMap({ favouriteCodes, currentCode, onSelect, trains, onSelectTrain, corner }: Props) {
  const { t, stationName } = useI18n();
  return (
    <nav className={`line-map${corner ? ' line-map--with-bar' : ''}`} aria-label={t.mapLabel} style={{ width: WIDTH, height: HEIGHT }}>
      {corner && (
        <div className="line-map__bar">
          <div className="line-map__bar-controls">{corner}</div>
          <span className="line-map__compass line-map__compass--bar" aria-hidden>
            {t.compassNorth} ↑
          </span>
        </div>
      )}
      <svg className="line-map__svg" width={WIDTH} height={HEIGHT} aria-hidden>
        {!corner && (
          <text x={WIDTH - 14} y={18} textAnchor="end" className="line-map__compass">
            {t.compassNorth} ↑
          </text>
        )}
        <path d={branchPath(X.malahide)} className="line-map__track" />
        <path d={branchPath(X.howth)} className="line-map__track" />
        <path d={`M${X.trunk},${junctionY} V${HEIGHT - TOP}`} className="line-map__track" />

        <path
          d={`M${X.trunk - 22},${cityTop - 10} h-6 V${cityBottom + 10} h6`}
          className="line-map__bracket"
        />
        <text
          className="line-map__zone"
          transform={`translate(${X.trunk - 38}, ${(cityTop + cityBottom) / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {t.cityCentre}
        </text>

        {/* Beck style: circles for termini, the junction, interchanges and the current station; ticks for the rest. */}
        {POINTS.map((p) =>
          ENDS.has(p.code) || isHub(p.code) || p.code === currentCode ? (
            <circle
              key={p.code}
              cx={p.x}
              cy={p.y}
              r={isHub(p.code) ? 12 : 9}
              className={`line-map__dot${isHub(p.code) ? ' line-map__dot--hub' : ''}${p.code === currentCode ? ' line-map__dot--current' : ''}`}
            />
          ) : (
            <path key={p.code} d={tickPath(p)} className="line-map__tick" />
          ),
        )}
      </svg>

      {POINTS.map((p) => {
        const station = findStationByCode(p.code)!;
        const favourite = favouriteCodes.includes(p.code);
        return (
          <button
            key={p.code}
            className={`line-map__stop line-map__stop--${p.side}${p.code === currentCode ? ' line-map__stop--current' : ''}${ENDS.has(p.code) || isHub(p.code) ? ' line-map__stop--major' : ''}${isHub(p.code) ? ' line-map__stop--hub' : ''}`}
            style={stopStyle(p)}
            onClick={() => onSelect(p.code)}
            aria-label={`${stationName(station, true)}${favourite ? `, ${t.favourite}` : ''}`}
          >
            <span className="line-map__name">
              <Caps text={stationName(station)} />
            </span>
            {favourite && <span className="line-map__fav">★</span>}
          </button>
        );
      })}
      <MapHits width={WIDTH} height={HEIGHT} points={POINTS} onSelect={onSelect} />
      {trains && <TrainMarkers trains={trains} pointOf={pointOf} onSelect={(train) => onSelectTrain?.(train)} />}
    </nav>
  );
}

/** A short tick from the line towards the station's label. */
function tickPath(p: Point): string {
  const towardsLabel = p.side === 'malahide' ? -1 : 1;
  return `M${p.x},${p.y} h${towardsLabel * 12}`;
}

/** Each label is a full-height tap target covering its dot; Malahide labels sit left of their line, the rest right. */
function stopStyle(p: Point): CSSProperties {
  const top = p.y - ROW / 2;
  if (p.side === 'malahide') return { top, left: 0, width: p.x + 16 };
  return { top, left: p.x - 16, right: 0 };
}
