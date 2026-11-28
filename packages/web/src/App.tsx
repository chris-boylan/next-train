import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { findStationByCode, hasLiveData, isLuasStop, isServiceId, luasLineOf, SERVICES, type ServiceId, type Station } from '@dart-times/core';
import { fetchFavourites, setFavourite } from './lib/api';
import { getDeviceId } from './lib/deviceId';
import { HelpContext } from './lib/help';
import { useI18n } from './lib/i18n';
import { type HomeMode, useHomeMode, useStationView } from './lib/prefs';
import { useSwipe } from './lib/useSwipe';
import { HomeTitle } from './components/HomeTitle';
import { NetworkMap } from './maps/NetworkMap';
import type { RoutesView } from './maps/RoutesMap';
import { HelpPage } from './screens/HelpPage';
import { shouldWelcome, Welcome } from './components/Welcome';
import { ServicePicker } from './screens/ServicePicker';
import { forgetScroll } from './lib/scrollMemory';
import { StationBoard } from './screens/StationBoard';
import { StationPicker } from './screens/StationPicker';
import { TrackView } from './screens/TrackView';

/** A first ever visit is greeted once, over the service picker (which loads underneath). Decided once per page
 *  load, as deciding also marks it seen (and React may run a state initialiser twice). */
const WELCOME_ON_LOAD = shouldWelcome();

/** Service → line map → station. Always opens on the home page: trains (the service picker) or trams (the Luas
 * map), whichever was last swiped to; ?service=&station= links go straight in, and ?help opens the help page. Help sits on top of whatever screen it was opened from. */
export function App() {
  const [showHelp, setShowHelp] = useState(() => new URLSearchParams(location.search).has('help'));
  const [welcome, setWelcome] = useState(WELCOME_ON_LOAD);
  return (
    <HelpContext.Provider value={() => setShowHelp(true)}>
      {welcome && <Welcome onClose={() => setWelcome(false)} />}
      {showHelp ? <HelpPage onBack={() => setShowHelp(false)} /> : null}
      <div hidden={showHelp}>
        <Screens />
      </div>
    </HelpContext.Provider>
  );
}

function Screens() {
  const { t, stationName } = useI18n();
  const deviceId = useMemo(getDeviceId, []);
  const params = new URLSearchParams(location.search);
  const [serviceId, setServiceId] = useState<ServiceId | undefined>(() => {
    const id = params.get('service') ?? (params.get('station') ? 'dart' : undefined);
    return isServiceId(id) ? id : undefined;
  });
  // The home page is trains (the service list) or trams (the Luas map, which is then the home page itself).
  const [homeMode, setHomeMode] = useHomeMode();
  const service = (serviceId && SERVICES[serviceId]) || (homeMode === 'tram' ? SERVICES.luas : undefined);
  const [stationCode, setStationCode] = useState(() => {
    const code = params.get('station');
    return service && code ? findStationByCode(code, service.stations)?.code : undefined;
  });
  const [favourites, setFavourites] = useState<Station[]>([]);
  const [stationView, setStationView] = useStationView();
  // Which page a tracks/board switch is arriving on, for its transition in (cleared once it has played).
  const [arriving, setArriving] = useState<'tracks' | 'board'>();
  // The view setting is an external store, whose updates render straight away: commit `arriving` first, or the
  // new page would appear before it knows it's arriving and skip its transition.
  const switchView = (view: 'tracks' | 'board') => {
    flushSync(() => setArriving(view));
    setStationView(view);
  };
  const [showNetwork, setShowNetwork] = useState(false);
  // A station opened from the all-stations map, or from a favourite on the home page.
  const [boardStation, setBoardStation] = useState<{ code: string; name: string; from: 'map' | 'home' }>();
  // Highlighted on the map when you go back to it.
  const [previousCode, setPreviousCode] = useState(stationCode);
  // Each route-based service's map view (all routes, the route list, or one route), kept here so coming back
  // from a station returns to the route you picked it from.
  const [routesViews, setRoutesViews] = useState<Partial<Record<ServiceId, RoutesView>>>({});

  // Opening a service some other way (a link, a favourite) puts the home page on its side: trams for the Luas,
  // trains for the rest, so going back lands where it belongs.
  useEffect(() => {
    if (serviceId) setHomeMode(serviceId === 'luas' ? 'tram' : 'train');
  }, [serviceId, setHomeMode]);

  // Switching the home page between trains and trams: the title slides in, until you leave the home page.
  const [homeSlide, setHomeSlide] = useState(false);
  const switchHome = (mode: HomeMode) => {
    if (mode === homeMode) return;
    setHomeSlide(true);
    setHomeMode(mode);
    setServiceId(undefined);
    setStationCode(undefined);
    setPreviousCode(undefined);
  };
  const homeSwipe = useSwipe(
    () => switchHome('tram'),
    () => switchHome('train'),
  );
  const homeTitle = <HomeTitle mode={homeMode} onChange={switchHome} slideIn={homeSlide} />;

  useEffect(() => {
    fetchFavourites(deviceId).then(setFavourites, (err: Error) => console.error(err));
  }, [deviceId]);

  // Each service brings its own track colours (DART green/orange, Enterprise purple, …). A Luas stop takes its
  // line's: red or green.
  useEffect(() => {
    document.documentElement.dataset.service =
      service?.id === 'luas' && stationCode ? `luas-${luasLineOf(stationCode)}` : (service?.id ?? 'dart');
  }, [service?.id, stationCode]);

  const selectService = (id: ServiceId) => {
    forgetScroll(`map:${id}`); // a map opened from the service list starts at the top
    setHomeSlide(false);
    setServiceId(id);
    setStationCode(undefined);
    setPreviousCode(undefined);
  };

  const selectStation = (code: string) => {
    setHomeSlide(false);
    setStationCode(code);
    setPreviousCode(code);
  };

  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const toggleFavourite = (code: string) =>
    setFavourite(deviceId, code, !isFavourite(code)).then(setFavourites, (err: Error) => console.error(err));

  if (boardStation) {
    // NI Railways stations have no live data, except where the Enterprise calls (Belfast, Portadown, Newry).
    const live = hasLiveData(boardStation.code);
    return (
      <StationBoard
        code={boardStation.code}
        name={boardStation.name}
        live={live}
        note={live ? undefined : t.nirNoLiveData}
        mode="all"
        backLabel={boardStation.from === 'home' ? t.services : t.map}
        onBack={() => setBoardStation(undefined)}
        // Stations only on the all-stations map (no live data from Irish Rail) can't be favourites.
        favourite={
          findStationByCode(boardStation.code)
            ? { on: isFavourite(boardStation.code), toggle: () => toggleFavourite(boardStation.code) }
            : undefined
        }
      />
    );
  }
  if (showNetwork) {
    return <NetworkMap onBack={() => setShowNetwork(false)} onSelectStation={(code, name) => setBoardStation({ code, name, from: 'map' })} />;
  }
  if (!service) {
    // A home-page favourite isn't tied to one service (Connolly is on four), so it opens every train there.
    return (
      <ServicePicker
        onSelect={selectService}
        onOpenNetwork={() => {
          forgetScroll('map:network');
          setShowNetwork(true);
        }}
        // Luas stops are Next Tram?'s favourites, shown there.
        favourites={favourites.filter((s) => !isLuasStop(s.code))}
        onSelectFavourite={(s) => setBoardStation({ code: s.code, name: stationName(s), from: 'home' })}
        title={homeTitle}
        swipe={homeSwipe}
      />
    );
  }

  const station = stationCode ? findStationByCode(stationCode, service.stations) : undefined;
  const routesView = routesViews[service.id] ?? { mode: 'all' };
  // The route the station was picked from on the map, when there is one: back goes to it, and a Commuter hub's
  // station page opens on it.
  const routeId = routesView.mode === 'byRoute' ? routesView.routeId : undefined;
  // Every station opens on its two tracks, or (by the button by its name) as a board, remembered.
  if (station && stationView === 'board') {
    const routeNames: Record<string, string> =
      service.id === 'commuter' ? t.commuterRoutes : service.id === 'intercity' ? t.intercityRoutes : service.id === 'nir' ? t.nirRoutes : {};
    const backLabel = (routeId && routeNames[routeId]) || t.stations;
    // NI Railways stations have no live data, except where the Enterprise calls; the board says so.
    const nir = service.id === 'nir';
    const live = !nir || hasLiveData(station.code);
    return (
      <StationBoard
        key={station.code}
        code={station.code}
        name={stationName(station)}
        mode={nir ? 'all' : service.id}
        live={live}
        note={nir ? (live ? t.nirEnterpriseOnly : t.nirNoLiveData) : undefined}
        backLabel={backLabel}
        onBack={() => setStationCode(undefined)}
        favourite={{ on: isFavourite(station.code), toggle: () => toggleFavourite(station.code) }}
        onShowTracks={() => switchView('tracks')}
        entering={arriving === 'board'}
        onEntered={() => setArriving(undefined)}
      />
    );
  }
  return station ? (
    <TrackView
      key={`${service.id}:${station.code}`}
      service={service}
      station={station}
      isFavourite={isFavourite(station.code)}
      onToggleFavourite={() => toggleFavourite(station.code)}
      onChangeStation={() => setStationCode(undefined)}
      onSelectStation={selectStation}
      initialLineId={routeId}
      onShowBoard={() => switchView('board')}
      enterFromBoard={arriving === 'tracks'}
      onEntered={() => setArriving(undefined)}
    />
  ) : (
    <StationPicker
      service={service}
      onBack={() => setServiceId(undefined)}
      favourites={favourites}
      currentCode={previousCode}
      onSelect={selectStation}
      onToggleFavourite={toggleFavourite}
      routesView={routesView}
      onRoutesViewChange={(view) => setRoutesViews((views) => ({ ...views, [service.id]: view }))}
      // The Luas map is the trams' home page.
      home={service.id === 'luas' ? { title: homeTitle, swipe: homeSwipe } : undefined}
    />
  );
}
