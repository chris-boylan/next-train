import { useMemo } from 'react';
import { type LuasRouteId, type Service } from '@dart-times/core';
import { useI18n } from '../lib/i18n';
import { PositionedMap } from './PositionedMap';
import { LUAS_ROUTE_MAP } from './data/luasRoutes';
import { luasGreenSchematic, luasRedSchematic } from './data/luasSchematic';
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

/**
 * The Luas: All (the Red line's map above the Green line's), or one line. Each is hand-placed (luasSchematic.ts),
 * with the Green line's one-way city-centre loop drawn as two sides with arrows.
 */
export function LuasMap({ view, onViewChange, service, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const schematics = useMemo(() => ({ red: luasRedSchematic(), green: luasGreenSchematic() }), []);
  const byCode = new Map(service.stations.map((s) => [s.code, s]));
  const name = (code: string) => {
    const station = byCode.get(code);
    return station ? stationName(station) : code;
  };
  const shown = view.mode === 'byRoute' && LINES.includes(view.routeId as LuasRouteId) ? [view.routeId as LuasRouteId] : LINES;
  const choices: { key: 'all' | LuasRouteId; label: string }[] = [
    { key: 'all', label: t.allRoutes },
    ...LINES.map((id) => ({ key: id, label: t.luasRoutes[id] })),
  ];
  const current = shown.length === 1 ? shown[0]! : 'all';

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
      {shown.map((id) => {
        const route = LUAS_ROUTE_MAP.routes.find((r) => r.id === id)!;
        const schematic = schematics[id];
        const degree = (code: string) => route.edges.filter((e) => e.includes(code)).length;
        return (
          <section key={id} className="luas-map">
            <h2 className="commuter__route" style={{ borderColor: route.colour }}>
              {t.luasRoutes[id]}
            </h2>
            <PositionedMap
              schematic={schematic}
              edges={route.edges}
              codes={Object.keys(schematic.points)}
              name={name}
              major={(code) => degree(code) !== 2}
              colourOf={() => route.colour}
              favouriteCodes={favouriteCodes}
              currentCode={currentCode}
              onSelect={onSelect}
              label={t.luasRoutes[id]}
            />
          </section>
        );
      })}
    </>
  );
}
