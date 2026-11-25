import { useState } from 'react';
import { searchStations, type Station } from '@dart-times/core';
import { LineMap } from './LineMap';

interface Props {
  favourites: Station[];
  currentCode?: string;
  onSelect: (code: string) => void;
  onToggleFavourite: (code: string) => void;
}

export function StationPicker({ favourites, currentCode, onSelect, onToggleFavourite }: Props) {
  const [query, setQuery] = useState('');
  const isFavourite = (code: string) => favourites.some((s) => s.code === code);
  const results = query.trim() ? searchStations(query) : [];

  return (
    <div className="picker">
      <header className="picker__header">
        <h1>DART Times</h1>
        <input
          className="search"
          type="search"
          placeholder="Find a station"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a station"
        />
        {favourites.length > 0 && !query.trim() && (
          <div className="favourites" aria-label="Favourite stations">
            {favourites.map((s) => (
              <button key={s.code} className="chip chip--fav" onClick={() => onSelect(s.code)}>
                ★ {s.shortName}
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
                {s.name}
              </button>
              <button
                className={`star${isFavourite(s.code) ? ' star--on' : ''}`}
                onClick={() => onToggleFavourite(s.code)}
                aria-pressed={isFavourite(s.code)}
                aria-label={isFavourite(s.code) ? `Remove ${s.shortName} from favourites` : `Add ${s.shortName} to favourites`}
              >
                {isFavourite(s.code) ? '★' : '☆'}
              </button>
            </li>
          ))}
          {!results.length && <li className="picker__empty">No DART station matches “{query}”.</li>}
        </ul>
      ) : (
        <LineMap favouriteCodes={favourites.map((s) => s.code)} currentCode={currentCode} onSelect={onSelect} />
      )}
    </div>
  );
}
