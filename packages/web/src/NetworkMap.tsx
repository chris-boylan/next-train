import { useMemo, useState } from 'react';
import { DART_LINE, findStationByCode, searchStations, type Station } from '@dart-times/core';
import { useI18n } from './i18n';
import { NETWORK_EDGES, NETWORK_STATIONS } from './network.data';
import { useNetworkName } from './networkNames';
import { OptionsMenu } from './OptionsMenu';
import { TreeMap } from './TreeMap';

interface Props {
  onBack: () => void;
  onSelectStation: (code: string, name: string) => void;
}

const ROOT = 'CNLLY';
const DART_GREEN = '#169b62';
const pairKey = (a: string, b: string) => [a, b].sort().join('|');
const dartPairs = new Set(DART_LINE.paths.flatMap((path) => path.slice(1).map((code, i) => pairKey(path[i]!, code))));
const dartStations = new Set(DART_LINE.paths.flat());
const connected = new Set(NETWORK_EDGES.flat());

// Every station on the map in the shape the shared search expects. DART and Enterprise stations bring
// their aliases and Irish names; the rest search by their Irish Rail name.
const SEARCHABLE: Station[] = NETWORK_STATIONS.map(
  (s) =>
    findStationByCode(s.code) ?? {
      code: s.code,
      name: s.name,
      shortName: s.name,
      aliases: [],
      branch: 'trunk',
      lat: s.lat,
      lon: s.lon,
    },
);

/** Every Irish Rail station as one schematic, fitting the screen's width and scrolling down. Not linked to live times yet. */
export function NetworkMap({ onBack, onSelectStation }: Props) {
  const { t } = useI18n();
  const name = useNetworkName();
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchStations(query, SEARCHABLE) : [];
  const unmapped = useMemo(() => NETWORK_STATIONS.filter((s) => !connected.has(s.code)), []);

  return (
    <div className="network">
      <header className="picker__header">
        <div className="picker__title">
          <button className="chip" onClick={onBack}>
            ‹ {t.services}
          </button>
          <OptionsMenu />
        </div>
        <h1 className="picker__service">{t.allStations}</h1>
        <input
          className="search"
          type="search"
          placeholder={t.findStation}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.findStation}
        />
      </header>

      {query.trim() ? (
        <ul className="station-list">
          {results.map((s) => (
            <li key={s.code} className="station-row">
              <button className="station-row__name" onClick={() => onSelectStation(s.code, name(s.code))}>
                {name(s.code)}
              </button>
            </li>
          ))}
          {!results.length && <li className="picker__empty">{t.noMatch(query)}</li>}
        </ul>
      ) : (
        <>
          <TreeMap
            edges={NETWORK_EDGES}
            root={ROOT}
            name={name}
            colourOf={(a, b) => (dartPairs.has(pairKey(a, b)) ? DART_GREEN : undefined)}
            tickColourOf={(code) => (dartStations.has(code) ? DART_GREEN : undefined)}
            onSelect={onSelectStation}
            label={t.allStations}
          />
          {unmapped.length > 0 && (
            <p className="network__unmapped">
              {t.notYetMapped}: {unmapped.map((s) => name(s.code)).join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
