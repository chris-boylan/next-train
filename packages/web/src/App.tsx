import { useEffect, useMemo, useState } from 'react';
import { findStationByCode, type Station } from '@dart-times/core';
import { fetchFavourites, setFavourite } from './api';
import { getDeviceId } from './deviceId';
import { getLastStation, setLastStation } from './prefs';
import { StationPicker } from './StationPicker';
import { TrackView } from './TrackView';

export function App() {
  const deviceId = useMemo(getDeviceId, []);
  // A ?station=CNLLY link wins; otherwise, like a mobile app, reopen on the station you last looked at.
  const [stationCode, setStationCode] = useState(() => {
    const code = new URLSearchParams(location.search).get('station') ?? getLastStation();
    return code ? findStationByCode(code)?.code : undefined;
  });
  const [favourites, setFavourites] = useState<Station[]>([]);
  // Highlighted on the map when you go back to it.
  const [previousCode, setPreviousCode] = useState(stationCode);

  useEffect(() => {
    fetchFavourites(deviceId).then(setFavourites, (err: Error) => console.error(err));
  }, [deviceId]);

  const selectStation = (code: string) => {
    setStationCode(code);
    setPreviousCode(code);
    setLastStation(code);
  };

  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const toggleFavourite = (code: string) =>
    setFavourite(deviceId, code, !isFavourite(code)).then(setFavourites, (err: Error) => console.error(err));

  const station = stationCode ? findStationByCode(stationCode) : undefined;

  return station ? (
    <TrackView
      key={station.code}
      station={station}
      isFavourite={isFavourite(station.code)}
      onToggleFavourite={() => toggleFavourite(station.code)}
      onChangeStation={() => setStationCode(undefined)}
      onSelectStation={selectStation}
    />
  ) : (
    <StationPicker
      favourites={favourites}
      currentCode={previousCode}
      onSelect={selectStation}
      onToggleFavourite={toggleFavourite}
    />
  );
}
