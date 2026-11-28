import { useMemo } from 'react';
import { type LuasRouteId, type Service } from '@dart-times/core';
import { NewsTicker } from '../components/NewsTicker';
import { useI18n } from '../lib/i18n';
import { useLuasStatus } from '../lib/useLuasStatus';
import { PositionedMap } from './PositionedMap';
import { LUAS_ROUTE_MAP } from './data/luasRoutes';
import { luasAllSchematic, luasGreenSchematic, luasRedSchematic } from './data/luasSchematic';
import type { RoutesView } from './RoutesMap';

interface Props {
  view: RoutesView;
  onViewChange: (view: RoutesView) => void;
  service: Service;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

const LINES: LuasRouteId[] = ['red', 'green'];
/** On All, circles for the stops where you change between the lines on foot. */
const ALL_CIRCLES = new Set(['LU_ABB', 'LU_OGP', 'LU_MAR']);
/** The full story behind a line's status message ("… See news."). */
const LUAS_NEWS_URL = 'https://www.luas.ie/travel-update/';

/**
 * The Luas: All (both lines on one map, the Red crossing the Green through its city-centre loop), or one line. Each is hand-placed (luasSchematic.ts), with the Green line's one-way city-centre
 * loop drawn as two sides with arrows.
 */
export function LuasMap({ view, onViewChange, service, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const schematics = useMemo(() => ({ red: luasRedSchematic(), green: luasGreenSchematic(), all: luasAllSchematic() }), []);
  const byCode = new Map(service.stations.map((s) => [s.code, s]));
  const name = (code: string) => {
    const station = byCode.get(code);
    return station ? stationName(station) : code;
  };
  const single = view.mode === 'byRoute' && LINES.includes(view.routeId as LuasRouteId) ? (view.routeId as LuasRouteId) : undefined;
  const choices: { key: 'all' | LuasRouteId; label: string }[] = [
    { key: 'all', label: t.allRoutes },
    ...LINES.map((id) => ({ key: id, label: t.luasRoutes[id] })),
  ];
  const current = single ?? 'all';
  const routes = LUAS_ROUTE_MAP.routes.filter((r) => (single ? r.id === single : LINES.includes(r.id)));
  const edges = routes.flatMap((r) => r.edges);
  const colourOf = (a: string, b: string) => routes.find((r) => r.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))?.colour;
  const degree = (code: string) => edges.filter((e) => e.includes(code)).length;
  const schematic = schematics[single ?? 'all'];
  const label = single ? t.luasRoutes[single] : t.serviceNames.luas;
  // News: the lines shown that aren't running normally (both on All, one when filtered), scrolling across.
  const status = useLuasStatus();
  const news = routes.flatMap((r) => {
    const line = status[r.id];
    return line?.disrupted ? [{ key: r.id, label: t.luasRoutes[r.id], colour: r.colour, message: line.message }] : [];
  });

  return (
    <>
      <div className="segmented commuter__mode" role="radiogroup" aria-label={t.serviceNames.luas}>
        {choices.map(({ key, label }) => (
          <button
            key={key}
            role="radio"
            aria-checked={current === key}
            className={`segmented__option${current === key ? ' segmented__option--on' : ''}`}
            onClick={() => onViewChange(key === 'all' ? { mode: 'all' } : { mode: 'byRoute', routeId: key })}
          >
            {label}
          </button>
        ))}
      </div>
      <NewsTicker items={news} href={LUAS_NEWS_URL} />
      {single && (
        <h2 className="commuter__route" style={{ borderColor: routes[0]!.colour }}>
          {t.luasRoutes[single]}
        </h2>
      )}
      <PositionedMap
        key={single ?? 'all'}
        schematic={schematic}
        edges={edges}
        codes={Object.keys(schematic.points)}
        name={name}
        major={(code) => degree(code) !== 2 || (!single && ALL_CIRCLES.has(code))}
        colourOf={colourOf}
        favouriteCodes={favouriteCodes}
        currentCode={currentCode}
        onSelect={onSelect}
        className={single ? '' : 'schematic--luas-all'}
        label={label}
      />
    </>
  );
}
