import { useState } from 'react';
import { searchStations, type Service, type Station } from '@dart-times/core';
import { LineMap } from './LineMap';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';
import { SimpleLineMap } from './SimpleLineMap';

interface Props {
  service: Service;
  onBack: () => void;
  favourites: Station[];
  currentCode?: string;
  onSelect: (code: string) => void;
  onToggleFavourite: (code: string) => void;
}

/** A service's line map (or search results), where you pick a station. */
export function StationPicker({ service, onBack, favourites: allFavourites, currentCode, onSelect, onToggleFavourite }: Props) {
  const { t, stationName } = useI18n();
  const [query, setQuery] = useState('');
  // Favourites from this service only; Connolly counts for both.
  const favourites = allFavourites.filter((f) => service.stations.some((s) => s.code === f.code));
  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const results = query.trim() ? searchStations(query, service.stations) : [];
  const mapProps = { favouriteCodes: favourites.map((s) => s.code), currentCode, onSelect };

  return (
    <div className="picker">
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
        {favourites.length > 0 && !query.trim() && (
          <div className="favourites" aria-label={t.favouriteStations}>
            {favourites.map((s) => (
              <button key={s.code} className="chip chip--fav" onClick={() => onSelect(s.code)}>
                ★ <Caps text={stationName(s)} />
              </button>
            ))}
          </div>
        )}
      </header>

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
        <LineMap {...mapProps} />
      ) : (
        <SimpleLineMap service={service} {...mapProps} />
      )}
    </div>
  );
}
