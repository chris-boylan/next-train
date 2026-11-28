import { useState } from 'react';
import { isLiveService, type LiveTrain, searchStations, type Service, type Station } from '@dart-times/core';
import { BranchLineMap } from '../maps/BranchLineMap';
import { COMMUTER_MAP_TERMINI, COMMUTER_ROUTE_MAP } from '../maps/data/commuterRoutes';
import { commuterSchematicFor } from '../maps/data/commuterSchematic';
import { INTERCITY_ROUTE_MAP } from '../maps/data/intercityRoutes';
import { intercitySchematic, nirSchematic } from '../maps/data/intercitySchematic';
import { NIR_ROUTE_MAP } from '../maps/data/nirRoutes';
import { LUAS_ROUTE_MAP } from '../maps/data/luasRoutes';
import { NETWORK_TERMINI, withBreaks } from '../maps/data/networkSchematic';
import { LineMap } from '../maps/LineMap';
import { useScrollMemory } from '../lib/scrollMemory';
import { SchematicMap } from '../maps/SchematicMap';
import { SCHEMATICS } from '../maps/data/schematics';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { useFavouritesPlace, useLiveTrainsPref } from '../lib/prefs';
import { useLiveTrains } from '../lib/useLiveTrains';
import { TrainSheet } from '../components/TrainSheet';
import { LiveTrainsToggle } from '../components/LiveTrainsToggle';
import { RoutesMap, type RoutesView } from '../maps/RoutesMap';
import { SimpleLineMap } from '../maps/SimpleLineMap';

interface Props {
  service: Service;
  onBack: () => void;
  favourites: Station[];
  currentCode?: string;
  onSelect: (code: string) => void;
  onToggleFavourite: (code: string) => void;
  /** For route-based services (Dublin Commuter, InterCity): the map's view, kept by the app. */
  routesView: RoutesView;
  onRoutesViewChange: (view: RoutesView) => void;
}

/** A service's line map (or search results), where you pick a station. */
export function StationPicker({
  service,
  onBack,
  favourites: allFavourites,
  currentCode,
  onSelect,
  onToggleFavourite,
  routesView,
  onRoutesViewChange,
}: Props) {
  const { t, stationName } = useI18n();
  const [query, setQuery] = useState('');
  // Back from a station, the map is where you left it; opened from the service list, it starts at the top.
  const scrollRef = useScrollMemory<HTMLDivElement>(`map:${service.id}`);
  const [favouritesPlace] = useFavouritesPlace();
  // Live trains: DART, Enterprise, Dublin Commuter and InterCity so far, and off until the viewer turns them on (one setting for both).
  const hasLiveTrains = isLiveService(service.id);
  const [liveOn, setLiveOn] = useLiveTrainsPref();
  const live = useLiveTrains(service.id, hasLiveTrains && liveOn);
  const [selectedTrain, setSelectedTrain] = useState<LiveTrain>();
  // Favourites from this service only; Connolly counts for both.
  const favourites = allFavourites.filter((f) => service.stations.some((s) => s.code === f.code));
  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const results = query.trim() ? searchStations(query, service.stations) : [];
  const liveProps = {
    trains: liveOn ? live.trains : undefined,
    onSelectTrain: setSelectedTrain,
    corner: hasLiveTrains && (
      <LiveTrainsToggle on={liveOn} onChange={setLiveOn} loading={live.loading} failed={!!live.error} />
    ),
  };
  const mapProps = { favouriteCodes: favourites.map((s) => s.code), currentCode, onSelect };

  return (
    <div className="screen picker">
      <header className="picker__header">
        <div className="picker__title">
          <button className="chip" onClick={onBack}>
            ‹ {t.services}
          </button>
          <OptionsMenu />
        </div>
        <h1 className="picker__service">{t.serviceNames[service.id]}</h1>
        <input
          className="search"
          type="search"
          placeholder={t.findStation}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.findStation}
        />
        {favouritesPlace === 'service' && favourites.length > 0 && !query.trim() && (
          <div className="favourites" aria-label={t.favouriteStations}>
            {favourites.map((s) => (
              <button key={s.code} className="chip chip--fav" onClick={() => onSelect(s.code)}>
                ★ <Caps text={stationName(s)} />
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="screen__scroll" ref={scrollRef}>
        {query.trim() ? (
          <ul className="station-list">
            {results.map((s) => (
              <li key={s.code} className="station-row">
                <button className="station-row__name" onClick={() => onSelect(s.code)}>
                  {stationName(s, true)}
                </button>
                <button
                  className={`star${isFavourite(s.code) ? ' star--on' : ''}`}
                  onClick={() => onToggleFavourite(s.code)}
                  aria-pressed={isFavourite(s.code)}
                  aria-label={isFavourite(s.code) ? t.removeFavourite(stationName(s)) : t.addFavourite(stationName(s))}
                >
                  {isFavourite(s.code) ? '★' : '☆'}
                </button>
              </li>
            ))}
            {!results.length && <li className="picker__empty">{t.noMatch(query)}</li>}
          </ul>
        ) : service.id === 'dart' ? (
          <LineMap {...mapProps} {...liveProps} />
        ) : service.id === 'commuter' ? (
          <RoutesMap
            view={routesView}
            onViewChange={onRoutesViewChange}
            service={service}
            routeMap={COMMUTER_ROUTE_MAP}
            routeName={(id) => t.commuterRoutes[id]}
            schematic={commuterSchematicFor}
            mapTermini={COMMUTER_MAP_TERMINI}
            hubs={['CNLLY', 'HSTON']}
            {...mapProps}
            {...liveProps}
          />
        ) : service.id === 'intercity' ? (
          <RoutesMap
            view={routesView}
            onViewChange={onRoutesViewChange}
            service={service}
            routeMap={INTERCITY_ROUTE_MAP}
            routeName={(id) => t.intercityRoutes[id]}
            // Drawn from the all-stations map, in its compact type, so the two look alike.
            schematic={intercitySchematic}
            mapClassName="schematic--compact"
            mapName={withBreaks}
            mapTermini={NETWORK_TERMINI}
            hubs={['HSTON', 'CNLLY']}
            {...mapProps}
            {...liveProps}
          />
        ) : service.id === 'nir' ? (
          <RoutesMap
            view={routesView}
            onViewChange={onRoutesViewChange}
            service={service}
            routeMap={NIR_ROUTE_MAP}
            routeName={(id) => t.nirRoutes[id]}
            // Drawn from the all-stations map's Northern Ireland, like InterCity's map.
            schematic={nirSchematic}
            mapClassName="schematic--compact"
            mapName={withBreaks}
            mapTermini={NETWORK_TERMINI}
            hubs={['BFSTC']}
            {...mapProps}
          />
        ) : service.id === 'luas' ? (
          <RoutesMap
            view={routesView}
            onViewChange={onRoutesViewChange}
            service={service}
            routeMap={LUAS_ROUTE_MAP}
            routeName={(id) => t.luasRoutes[id]}
            // No hand-placed map yet: each line is drawn as a tree from its city end.
            hubs={['LU_TPT', 'LU_BRO']}
            {...mapProps}
          />
        ) : SCHEMATICS[service.id] ? (
          <SchematicMap service={service} schematic={SCHEMATICS[service.id]!} {...mapProps} {...liveProps} />
        ) : service.line.paths.length > 1 ? (
          <BranchLineMap service={service} {...mapProps} />
        ) : (
          <SimpleLineMap service={service} {...mapProps} {...liveProps} />
        )}
        {selectedTrain && <TrainSheet train={selectedTrain} onClose={() => setSelectedTrain(undefined)} />}
      </div>
    </div>
  );
}
