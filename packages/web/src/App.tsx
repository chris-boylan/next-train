import { useEffect, useMemo, useState } from 'react';
import { findStationByCode, isServiceId, SERVICES, type ServiceId, type Station } from '@dart-times/core';
import { fetchFavourites, setFavourite } from './api';
import { getDeviceId } from './deviceId';
import { CommuterPreview } from './CommuterPreview';
import { NetworkMap } from './NetworkMap';
import { getLastService, getLastStation, setLastService, setLastStation } from './prefs';
import { ServicePicker } from './ServicePicker';
import { StationBoard } from './StationBoard';
import { StationPicker } from './StationPicker';
import { TrackView } from './TrackView';

/** Service → line map → station. Like a mobile app, it reopens where you left off. */
export function App() {
  const deviceId = useMemo(getDeviceId, []);
  const params = new URLSearchParams(location.search);
  // ?service=enterprise&station=DDALK links win; otherwise reopen on the last service and station.
  const [serviceId, setServiceId] = useState<ServiceId | undefined>(() => {
    const id = params.get('service') ?? getLastService() ?? (params.get('station') ? 'dart' : undefined);
    return isServiceId(id) ? id : undefined;
  });
  const service = serviceId && SERVICES[serviceId];
  const [stationCode, setStationCode] = useState(() => {
    const code = params.get('station') ?? getLastStation();
    return service && code ? findStationByCode(code, service.stations)?.code : undefined;
  });
  const [favourites, setFavourites] = useState<Station[]>([]);
  const [showNetwork, setShowNetwork] = useState(false);
  const [showCommuterPreview, setShowCommuterPreview] = useState(false);
  // A station opened from the all-stations map.
  const [boardStation, setBoardStation] = useState<{ code: string; name: string }>();
  // Highlighted on the map when you go back to it.
  const [previousCode, setPreviousCode] = useState(stationCode);

  useEffect(() => {
    fetchFavourites(deviceId).then(setFavourites, (err: Error) => console.error(err));
  }, [deviceId]);

  // Each service brings its own track colours (DART green/orange, Enterprise purple).
  useEffect(() => {
    document.documentElement.dataset.service = serviceId ?? 'dart';
  }, [serviceId]);

  const selectService = (id: ServiceId) => {
    setServiceId(id);
    setLastService(id);
    setStationCode(undefined);
    setPreviousCode(undefined);
  };

  const selectStation = (code: string) => {
    setStationCode(code);
    setPreviousCode(code);
    setLastStation(code);
  };

  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const toggleFavourite = (code: string) =>
    setFavourite(deviceId, code, !isFavourite(code)).then(setFavourites, (err: Error) => console.error(err));

  if (boardStation) {
    return <StationBoard code={boardStation.code} name={boardStation.name} onBack={() => setBoardStation(undefined)} />;
  }
  if (showNetwork) {
    return <NetworkMap onBack={() => setShowNetwork(false)} onSelectStation={(code, name) => setBoardStation({ code, name })} />;
  }
  if (showCommuterPreview) return <CommuterPreview onBack={() => setShowCommuterPreview(false)} />;
  if (!service) {
    return (
      <ServicePicker
        onSelect={selectService}
        onOpenNetwork={() => setShowNetwork(true)}
        onOpenCommuterPreview={() => setShowCommuterPreview(true)}
      />
    );
  }

  const station = stationCode ? findStationByCode(stationCode, service.stations) : undefined;
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
    />
  );
}
