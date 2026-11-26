import { useState } from 'react';
import { type CommuterRouteId, type Service } from '@dart-times/core';
import { ALL_COMMUTER_EDGES, COMMUTER_MAP_ROUTES, routeOf } from './commuterRoutes';
import { COMMUTER_SCHEMATIC } from './commuterSchematic';
import { useI18n } from './i18n';
import { PositionedMap } from './PositionedMap';
import { TreeMap } from './TreeMap';

interface Props {
  service: Service;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

/**
 * Dublin Commuter's map: every route on one geography-inspired map (Connolly and Heuston as hubs), or
 * choose a route and see only its stations. Tap a station for its departures.
 */
export function CommuterMap({ service, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const [mode, setMode] = useState<'all' | 'byRoute'>('all');
  const [routeId, setRouteId] = useState<CommuterRouteId>();
  const route = COMMUTER_MAP_ROUTES.find((r) => r.id === routeId);
  const byCode = new Map(service.stations.map((s) => [s.code, s]));
  const name = (code: string) => {
    const station = byCode.get(code);
    return station ? stationName(station) : code;
  };

  return (
    <>
      <div className="segmented commuter__mode" role="radiogroup" aria-label={t.serviceNames.commuter}>
        {(['all', 'byRoute'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            className={`segmented__option${mode === m ? ' segmented__option--on' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'all' ? t.allRoutes : t.byRoute}
          </button>
        ))}
      </div>

      {mode === 'all' ? (
        <>
          <ul className="commuter__legend">
            {COMMUTER_MAP_ROUTES.map((r) => (
              <li key={r.id}>
                <span className="commuter__swatch" style={{ background: r.colour }} />
                {t.commuterRoutes[r.id]}
              </li>
            ))}
          </ul>
          <PositionedMap
            schematic={COMMUTER_SCHEMATIC}
            edges={ALL_COMMUTER_EDGES}
            codes={service.stations.map((s) => s.code)}
            name={name}
            major={(code) => ALL_COMMUTER_EDGES.filter((e) => e.includes(code)).length !== 2}
            colourOf={(a, b) => routeOf(a, b)?.colour}
            favouriteCodes={favouriteCodes}
            currentCode={currentCode}
            onSelect={onSelect}
            label={t.allRoutes}
          />
        </>
      ) : route ? (
        <>
          <button className="chip commuter__back" onClick={() => setRouteId(undefined)}>
            ‹ {t.byRoute}
          </button>
          <h2 className="commuter__route" style={{ borderColor: route.colour }}>
            {t.commuterRoutes[route.id]}
          </h2>
          <TreeMap
            edges={route.edges}
            root={route.root}
            name={name}
            colourOf={() => route.colour}
            tickColourOf={() => route.colour}
            onSelect={(code) => onSelect(code)}
            label={t.commuterRoutes[route.id]}
          />
        </>
      ) : (
        <ul className="services commuter__routes">
          {COMMUTER_MAP_ROUTES.map((r) => (
            <li key={r.id}>
              <button className="service-tile" onClick={() => setRouteId(r.id)}>
                <span className="service-tile__stripes" aria-hidden>
                  <span className="service-tile__north" style={{ background: r.colour }} />
                </span>
                <span className="service-tile__text">
                  <span className="service-tile__name commuter__route-name">{t.commuterRoutes[r.id]}</span>
                  <span className="service-tile__route">{t.stationCount(new Set(r.edges.flat()).size)}</span>
                </span>
                <span className="service-tile__go" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
