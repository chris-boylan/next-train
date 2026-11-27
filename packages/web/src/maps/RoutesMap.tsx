import { useMemo } from 'react';
import type { Service } from '@dart-times/core';
import { type Lang, useI18n } from '../lib/i18n';
import { PositionedMap } from './PositionedMap';
import type { RouteMap } from './data/routeMaps';
import { realCode, type Schematic, withStandIns } from './data/schematics';
import { TreeMap } from './TreeMap';

/** Which view the map is showing: every route, the list of routes, or one route. Kept by the app, so coming
 *  back from a station returns to the same view. */
export interface RoutesView {
  mode: 'all' | 'byRoute';
  routeId?: string;
}

interface Props<Id extends string> {
  view: RoutesView;
  onViewChange: (view: RoutesView) => void;
  service: Service;
  routeMap: RouteMap<Id>;
  routeName: (id: Id) => string;
  /** Hand-placed map of every route, for a language (Irish names are longer and need more room). Without one,
   *  "All routes" draws each hub's network as a tree. */
  schematic?: (lang: Lang) => Schematic;
  /** Where the networks start (e.g. Heuston and Connolly), for the tree drawing. */
  hubs: string[];
  /** Extra class for the all-routes map, e.g. `schematic--compact` for smaller names. */
  mapClassName?: string;
  /** Adjusts a name for the all-routes map, e.g. where a long word may break between two lines. */
  mapName?: (name: string) => string;
  /** Stations drawn as circles even mid-line on the all-routes map, e.g. termini like Limerick. */
  mapTermini?: ReadonlySet<string>;
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
  view,
  onViewChange,
  service,
  routeMap,
  routeName,
  schematic: makeSchematic,
  hubs,
  mapClassName,
  mapName = (n) => n,
  mapTermini,
  favouriteCodes,
  currentCode,
  onSelect,
}: Props<Id>) {
  const { t, lang, stationName } = useI18n();
  const schematic = useMemo(() => makeSchematic?.(lang), [makeSchematic, lang]);
  const { mode } = view;
  const setMode = (m: RoutesView['mode']) => onViewChange({ ...view, mode: m });
  const setRouteId = (id: Id | undefined) => onViewChange({ ...view, routeId: id });
  const route = mode === 'byRoute' ? routeMap.routes.find((r) => r.id === view.routeId) : undefined;
  const byCode = new Map(service.stations.map((s) => [s.code, s]));
  // Stand-in stops (the Nenagh line's Ballybrophy on the InterCity map) are named, coloured and opened as the
  // station they stand for.
  const standIns = schematic?.standIns ?? [];
  const real = (code: string) => realCode(code, standIns);
  const name = (code: string) => {
    const station = byCode.get(real(code));
    return station ? stationName(station) : code;
  };
  const { coloursOf } = routeMap;
  const allEdges = withStandIns(routeMap.allEdges, standIns);
  // A hand-placed map may not place every station yet (InterCity's comes from the all-stations map): draw
  // what it places and list the rest, which are still on the route maps.
  const placed = schematic && [...service.stations.filter((s) => schematic.points[s.code]).map((s) => s.code), ...standIns.map((s) => s.code)];
  const unplaced = schematic ? service.stations.filter((s) => !schematic.points[s.code]) : [];
  const drawnEdges = schematic ? allEdges.filter(([a, b]) => schematic.points[a] && schematic.points[b]) : allEdges;
  const degree = (code: string) => drawnEdges.filter((e) => e.includes(code)).length;

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
            <>
              <PositionedMap
                schematic={schematic}
                edges={drawnEdges}
                codes={placed!}
                name={(code) => mapName(name(code))}
                major={(code) => degree(code) !== 2 || !!mapTermini?.has(code)}
                colourOf={(a, b) => coloursOf(real(a), real(b))}
                favouriteCodes={favouriteCodes}
                currentCode={currentCode}
                onSelect={(code) => onSelect(real(code))}
                className={mapClassName}
                label={t.allRoutes}
              />
              {unplaced.length > 0 && (
                <p className="network__unmapped">
                  {t.notDrawnYet}: {unplaced.map((s) => stationName(s)).join(', ')}
                </p>
              )}
            </>
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
        // Room between the All routes / By route switch and the route tiles. (Inline for now: styles.css has
        // another session's uncommitted changes; move to a .commuter__routes rule once those land.)
        <ul className="services commuter__routes" style={{ marginTop: 20 }}>
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
