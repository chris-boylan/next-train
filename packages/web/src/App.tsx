import { useEffect, useMemo, useState } from 'react';
import { findStationByCode, isServiceId, SERVICES, type ServiceId, type Station } from '@dart-times/core';
import { fetchFavourites, setFavourite } from './lib/api';
import { getDeviceId } from './lib/deviceId';
import { useI18n } from './lib/i18n';
import { NetworkMap } from './maps/NetworkMap';
import type { RoutesView } from './maps/RoutesMap';
import { ServicePicker } from './screens/ServicePicker';
import { StationBoard } from './screens/StationBoard';
import { StationPicker } from './screens/StationPicker';
import { TrackView } from './screens/TrackView';

/** Service → line map → station. Always opens on the service picker; ?service=&station= links go straight in. */
export function App() {
  const { t, stationName } = useI18n();
  const deviceId = useMemo(getDeviceId, []);
  const params = new URLSearchParams(location.search);
  const [serviceId, setServiceId] = useState<ServiceId | undefined>(() => {
    const id = params.get('service') ?? (params.get('station') ? 'dart' : undefined);
    return isServiceId(id) ? id : undefined;
  });
  const service = serviceId && SERVICES[serviceId];
  const [stationCode, setStationCode] = useState(() => {
    const code = params.get('station');
    return service && code ? findStationByCode(code, service.stations)?.code : undefined;
  });
  const [favourites, setFavourites] = useState<Station[]>([]);
  const [showNetwork, setShowNetwork] = useState(false);
  // A station opened from the all-stations map.
  const [boardStation, setBoardStation] = useState<{ code: string; name: string }>();
  // Highlighted on the map when you go back to it.
  const [previousCode, setPreviousCode] = useState(stationCode);
  // Each route-based service's map view (all routes, the route list, or one route), kept here so coming back
  // from a station returns to the route you picked it from.
  const [routesViews, setRoutesViews] = useState<Partial<Record<ServiceId, RoutesView>>>({});

  useEffect(() => {
    fetchFavourites(deviceId).then(setFavourites, (err: Error) => console.error(err));
  }, [deviceId]);

  // Each service brings its own track colours (DART green/orange, Enterprise purple, …).
  useEffect(() => {
    document.documentElement.dataset.service = serviceId ?? 'dart';
  }, [serviceId]);

  const selectService = (id: ServiceId) => {
    setServiceId(id);
    setStationCode(undefined);
    setPreviousCode(undefined);
  };

  const selectStation = (code: string) => {
    setStationCode(code);
    setPreviousCode(code);
  };

  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const toggleFavourite = (code: string) =>
    setFavourite(deviceId, code, !isFavourite(code)).then(setFavourites, (err: Error) => console.error(err));

  if (boardStation) {
    return (
      <StationBoard
        code={boardStation.code}
        name={boardStation.name}
        mode="all"
        backLabel={t.map}
        onBack={() => setBoardStation(undefined)}
      />
    );
  }
  if (showNetwork) {
    return <NetworkMap onBack={() => setShowNetwork(false)} onSelectStation={(code, name) => setBoardStation({ code, name })} />;
  }
  if (!service) return <ServicePicker onSelect={selectService} onOpenNetwork={() => setShowNetwork(true)} />;

  const station = stationCode ? findStationByCode(stationCode, service.stations) : undefined;
  const routesView = routesViews[service.id] ?? { mode: 'all' };
  if (station && (service.id === 'commuter' || service.id === 'intercity')) {
    // Back goes to the route the station was picked from, when there is one.
    const routeId = routesView.mode === 'byRoute' ? routesView.routeId : undefined;
    const routeNames: Record<string, string> = service.id === 'commuter' ? t.commuterRoutes : t.intercityRoutes;
    const backLabel = (routeId && routeNames[routeId]) || t.stations;
    // Commuter and Intercity stations can sit on several routes (Connolly is on four commuter routes), so they
    // get a board grouped by route and direction rather than the two-track page.
    return (
      <StationBoard
        key={station.code}
        code={station.code}
        name={stationName(station)}
        mode={service.id}
        backLabel={backLabel}
        onBack={() => setStationCode(undefined)}
        favourite={{ on: isFavourite(station.code), toggle: () => toggleFavourite(station.code) }}
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
    />
  );
}
