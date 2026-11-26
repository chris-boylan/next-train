import { useMemo, useState } from 'react';
import type { Service } from '@dart-times/core';
import { useI18n } from './i18n';
import { PositionedMap } from './PositionedMap';
import type { RouteMap } from './routeMaps';
import type { Schematic } from './schematics';
import { TreeMap } from './TreeMap';

interface Props<Id extends string> {
  service: Service;
  routeMap: RouteMap<Id>;
  routeName: (id: Id) => string;
  /** Hand-placed map of every route, given the gap between stations (Irish names need more room). Without
   *  one, "All routes" draws each hub's network as a tree. */
  schematic?: (row: number) => Schematic;
  /** Where the networks start (e.g. Heuston and Connolly), for the tree drawing. */
  hubs: string[];
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

/** Edges reachable from `root`: one hub's network, when a service has more than one. */
function componentOf(edges: [string, string][], root: string): [string, string][] {
  const seen = new Set([root]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [a, b] of edges) {
      if (seen.has(a) !== seen.has(b)) {
        seen.add(a).add(b);
        grew = true;
      }
    }
  }
  return edges.filter(([a]) => seen.has(a));
}

/**
 * A service made of several routes (Dublin Commuter, Intercity): every route on one map, or choose a route
 * and see only its stations. Tap a station for its departures.
 */
export function RoutesMap<Id extends string>({
  service,
  routeMap,
  routeName,
  schematic: makeSchematic,
  hubs,
  favouriteCodes,
  currentCode,
  onSelect,
}: Props<Id>) {
  const { t, lang, stationName } = useI18n();
  // Irish names are longer and wrap onto more lines, so stations sit further apart in Irish.
  const schematic = useMemo(() => makeSchematic?.(lang === 'ga' ? 50 : 34), [makeSchematic, lang]);
  const [mode, setMode] = useState<'all' | 'byRoute'>('all');
  const [routeId, setRouteId] = useState<Id>();
  const route = routeMap.routes.find((r) => r.id === routeId);
  const byCode = new Map(service.stations.map((s) => [s.code, s]));
  const name = (code: string) => {
    const station = byCode.get(code);
    return station ? stationName(station) : code;
  };
  const { allEdges, coloursOf } = routeMap;
  const degree = (code: string) => allEdges.filter((e) => e.includes(code)).length;

  return (
    <>
      <div className="segmented commuter__mode" role="radiogroup" aria-label={t.serviceNames[service.id]}>
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
            {routeMap.routes.map((r) => (
              <li key={r.id}>
                <span className="commuter__swatch" style={{ background: r.colour }} />
                {routeName(r.id)}
              </li>
            ))}
          </ul>
          {schematic ? (
            <PositionedMap
              schematic={schematic}
              edges={allEdges}
              codes={service.stations.map((s) => s.code)}
              name={name}
              major={(code) => degree(code) !== 2}
              colourOf={coloursOf}
              favouriteCodes={favouriteCodes}
              currentCode={currentCode}
              onSelect={onSelect}
              label={t.allRoutes}
            />
          ) : (
            hubs.map((hub) => (
              <TreeMap
                key={hub}
                edges={componentOf(allEdges, hub)}
                root={hub}
                name={name}
                colourOf={(a, b) => coloursOf(a, b)[0]}
                tickColourOf={(code) => coloursOf(...allEdges.find((e) => e.includes(code))!)[0]}
                onSelect={(code) => onSelect(code)}
                label={`${t.allRoutes}: ${name(hub)}`}
              />
            ))
          )}
        </>
      ) : route ? (
        <>
          <button className="chip commuter__back" onClick={() => setRouteId(undefined)}>
            ‹ {t.byRoute}
          </button>
          <h2 className="commuter__route" style={{ borderColor: route.colour }}>
            {routeName(route.id)}
          </h2>
          <TreeMap
            edges={route.edges}
            root={route.root}
            name={name}
            colourOf={() => route.colour}
            tickColourOf={() => route.colour}
            onSelect={(code) => onSelect(code)}
            label={routeName(route.id)}
          />
        </>
      ) : (
        <ul className="services commuter__routes">
          {routeMap.routes.map((r) => (
            <li key={r.id}>
              <button className="service-tile" onClick={() => setRouteId(r.id)}>
                <span className="service-tile__stripes" aria-hidden>
                  <span className="service-tile__north" style={{ background: r.colour }} />
                </span>
                <span className="service-tile__text">
                  <span className="service-tile__name commuter__route-name">{routeName(r.id)}</span>
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
