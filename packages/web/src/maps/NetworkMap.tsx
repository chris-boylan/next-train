import { useMemo, useState } from 'react';
import { findStationByCode, searchStations, type Station } from '@dart-times/core';
import { useI18n } from '../lib/i18n';
import { NETWORK_EDGES, NETWORK_STATIONS } from './data/network.data';
import { useNetworkName } from './data/networkNames';
import { NETWORK_TERMINI, networkSchematic, withBreaks } from './data/networkSchematic';
import { servicesByTrack, SERVICE_LINE_COLOURS, trackColours, type MapService } from './data/networkColours';
import { hasNoData, isNorthern, NI_STATIONS, withNorthernTrack } from './data/northernStations';
import { OptionsMenu } from '../components/OptionsMenu';
import { PositionedMap } from './PositionedMap';
import { Sheet } from '../components/Sheet';

interface Props {
  onBack: () => void;
  onSelectStation: (code: string, name: string) => void;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');
/**
 * Track to draw. Limerick–Thurles comes from stop lists that skip Limerick Junction; there's no such
 * line (trains go via the junction), so it's left off.
 */
export const MAP_EDGES = withNorthernTrack(NETWORK_EDGES).filter(([a, b]) => pairKey(a, b) !== pairKey('LMRCK', 'THRLS'));
const connected = new Set(MAP_EDGES.flat());
// Each piece of track in the colours of the services using it (see networkColours.ts).
const SERVICES_BY_TRACK = servicesByTrack(MAP_EDGES, isNorthern);
const LEGEND: MapService[] = ['dart', 'commuter', 'intercity', 'cork', 'enterprise', 'ni'];
const MAP_CODES = [...connected];
const degree = new Map<string, number>();
for (const [a, b] of MAP_EDGES) for (const c of [a, b]) degree.set(c, (degree.get(c) ?? 0) + 1);
// Circles for ends of lines, junctions and termini, ticks for the rest.
const major = (code: string) => degree.get(code) !== 2 || NETWORK_TERMINI.has(code);

// Every station on the map in the shape the shared search expects. DART and Enterprise stations bring
// their aliases and Irish names; the rest search by their Irish Rail name. Search doesn't use positions,
// so the hand-added NI stations (which have none) get 0, 0.
const SEARCHABLE: Station[] = [...NETWORK_STATIONS, ...NI_STATIONS.map((s) => ({ ...s, lat: 0, lon: 0 }))].map(
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
  const { t, lang } = useI18n();
  const name = useNetworkName();
  // Irish names are longer and wrap onto more lines, so the Irish map is taller.
  const schematic = useMemo(() => networkSchematic(lang), [lang]);
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchStations(query, SEARCHABLE) : [];
  const unmapped = useMemo(() => NETWORK_STATIONS.filter((s) => !connected.has(s.code)), []);
  // Northern Ireland stations without live times open a note saying so, rather than an empty board.
  const [noDataCode, setNoDataCode] = useState<string>();
  const open = (code: string) => (hasNoData(code) ? setNoDataCode(code) : onSelectStation(code, name(code)));

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
              {hasNoData(s.code) ? (
                <button className="station-row__name station-row__name--no-data" onClick={() => open(s.code)}>
                  {name(s.code)} <span className="network__no-data-note">· {t.noLiveData}</span>
                </button>
              ) : (
                <button className="station-row__name" onClick={() => open(s.code)}>
                  {name(s.code)}
                </button>
              )}
            </li>
          ))}
          {!results.length && <li className="picker__empty">{t.noMatch(query)}</li>}
        </ul>
      ) : (
        <>
          <ul className="commuter__legend">
            {LEGEND.map((s) => (
              <li key={s}>
                <span className="commuter__swatch" style={{ background: SERVICE_LINE_COLOURS[s] }} />
                {s === 'ni' ? `${t.niRailways} (${t.noLiveData})` : t.serviceNames[s]}
              </li>
            ))}
          </ul>
          <PositionedMap
            schematic={schematic}
            edges={MAP_EDGES}
            codes={MAP_CODES}
            name={(code) => withBreaks(name(code))}
            major={major}
            colourOf={(a, b) => trackColours(SERVICES_BY_TRACK, a, b)}
            onSelect={open}
            noData={hasNoData}
            className="schematic--compact schematic--network"
            label={t.allStations}
          />
          <p className="network__unmapped">
            <em>{t.italicStations}</em> {t.noLiveDataNote}
          </p>
          {unmapped.length > 0 && (
            <p className="network__unmapped">
              {t.notYetMapped}: {unmapped.map((s) => name(s.code)).join(', ')}
            </p>
          )}
        </>
      )}

      {noDataCode && (
        <Sheet title={name(noDataCode)} onClose={() => setNoDataCode(undefined)}>
          <p className="sheet__note">
            <strong>{t.noLiveDataTitle}.</strong> {t.noLiveDataExplained}
          </p>
        </Sheet>
      )}
    </div>
  );
}
