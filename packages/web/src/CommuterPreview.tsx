import { useState } from 'react';
import { ALL_COMMUTER_EDGES, COMMUTER_ROUTES, type CommuterRouteId, routeOf } from './commuterRoutes';
import { COMMUTER_SCHEMATIC } from './commuterSchematic';
import { useI18n } from './i18n';
import { useNetworkName } from './networkNames';
import { OptionsMenu } from './OptionsMenu';
import { PositionedMap } from './PositionedMap';
import { TreeMap } from './TreeMap';

interface Props {
  onBack: () => void;
}

/**
 * Preview to compare two ways of presenting Dublin Commuter: every route on one map, or choosing a
 * route first and seeing only its stations. Not linked to live times yet.
 */
export function CommuterPreview({ onBack }: Props) {
  const { t } = useI18n();
  const name = useNetworkName();
  const [mode, setMode] = useState<'all' | 'byRoute'>('all');
  const [routeId, setRouteId] = useState<CommuterRouteId>();
  const route = COMMUTER_ROUTES.find((r) => r.id === routeId);

  return (
    <div className="network">
      <header className="picker__header">
        <div className="picker__title">
          <button className="chip" onClick={onBack}>
            ‹ {t.services}
          </button>
          <OptionsMenu />
        </div>
        <h1 className="picker__service">{t.dublinCommuter}</h1>
        <p className="preview__note">{t.previewNote}</p>
        <div className="segmented preview__mode" role="radiogroup" aria-label={t.dublinCommuter}>
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
      </header>

      {mode === 'all' ? (
        <>
          <ul className="preview__legend">
            {COMMUTER_ROUTES.map((r) => (
              <li key={r.id}>
                <span className="preview__swatch" style={{ background: r.colour }} />
                {t.commuterRoutes[r.id]}
              </li>
            ))}
          </ul>
          <PositionedMap
            schematic={COMMUTER_SCHEMATIC}
            edges={ALL_COMMUTER_EDGES}
            codes={[...new Set(ALL_COMMUTER_EDGES.flat())]}
            name={name}
            major={(code) => ALL_COMMUTER_EDGES.filter((e) => e.includes(code)).length !== 2}
            colourOf={(a, b) => routeOf(a, b)?.colour}
            label={t.allRoutes}
          />
        </>
      ) : route ? (
        <>
          <button className="chip preview__back" onClick={() => setRouteId(undefined)}>
            ‹ {t.byRoute}
          </button>
          <h2 className="preview__route" style={{ borderColor: route.colour }}>
            {t.commuterRoutes[route.id]}
          </h2>
          <TreeMap
            edges={route.edges}
            root={route.root}
            name={name}
            colourOf={() => route.colour}
            label={t.commuterRoutes[route.id]}
          />
        </>
      ) : (
        <ul className="services">
          {COMMUTER_ROUTES.map((r) => {
            const stations = new Set(r.edges.flat()).size;
            return (
              <li key={r.id}>
                <button className="service-tile" onClick={() => setRouteId(r.id)}>
                  <span className="service-tile__stripes" aria-hidden>
                    <span className="service-tile__north" style={{ background: r.colour }} />
                  </span>
                  <span className="service-tile__text">
                    <span className="service-tile__name preview__route-name">{t.commuterRoutes[r.id]}</span>
                    <span className="service-tile__route">{t.stationCount(stations)}</span>
                  </span>
                  <span className="service-tile__go" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
