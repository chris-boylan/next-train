import { useState } from 'react';
import { searchStations, type Station } from '@dart-times/core';
import { LineMap } from './LineMap';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  favourites: Station[];
  currentCode?: string;
  onSelect: (code: string) => void;
  onToggleFavourite: (code: string) => void;
}

export function StationPicker({ favourites, currentCode, onSelect, onToggleFavourite }: Props) {
  const { t, stationName } = useI18n();
  const [query, setQuery] = useState('');
  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const results = query.trim() ? searchStations(query) : [];

  return (
    <div className="picker">
      <header className="picker__header">
        <div className="picker__title">
          <h1>DART Times</h1>
          <OptionsMenu />
        </div>
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
      ) : (
        <LineMap favouriteCodes={favourites.map((s) => s.code)} currentCode={currentCode} onSelect={onSelect} />
      )}
    </div>
  );
}
