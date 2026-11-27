import { useMemo, useState } from 'react';
import { findStationByCode, searchStations, type Station } from '@dart-times/core';
import { useI18n } from '../lib/i18n';
import { NETWORK_EDGES, NETWORK_STATIONS } from './data/network.data';
import { useNetworkName } from './data/networkNames';
import { NENAGH_END, NETWORK_SCHEMATIC, NETWORK_TERMINI, networkSchematic, withBreaks } from './data/networkSchematic';
import { servicesByTrack, SERVICE_LINE_COLOURS, trackColours, type MapService } from './data/networkColours';
import { hasNoData, isNorthern, NI_STATIONS, withNorthernTrack } from './data/northernStations';
import { OptionsMenu } from '../components/OptionsMenu';
import { useScrollMemory } from '../lib/scrollMemory';
import { PositionedMap } from './PositionedMap';

interface Props {
  onBack: () => void;
  onSelectStation: (code: string, name: string) => void;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');
/**
 * Track to draw. Limerick–Thurles comes from stop lists that skip Limerick Junction; there's no such
 * line (trains go via the junction), so it's left off.
 */
const TRACK = withNorthernTrack(NETWORK_EDGES).filter(([a, b]) => pairKey(a, b) !== pairKey('LMRCK', 'THRLS'));
/** The Nenagh line ends at its own Ballybrophy stop (see NENAGH_END), so its last link goes there instead. */
const DRAWN_TRACK = TRACK.map(([a, b]): [string, string] =>
  pairKey(a, b) === pairKey('BBRHY', 'RCREA') ? [NENAGH_END, 'RCREA'] : [a, b],
);
/** The real station a drawn code stands for: only the Nenagh line's Ballybrophy stop differs. */
const real = (code: string) => (code === NENAGH_END ? 'BBRHY' : code);
/** Lines the hand-placed layout doesn't draw yet (see networkSchematic.ts): trains run, the map has no room. */
export const NOT_DRAWN = [...new Set(DRAWN_TRACK.flat())].filter((code) => !NETWORK_SCHEMATIC.points[code]);
export const MAP_EDGES = DRAWN_TRACK.filter(([a, b]) => NETWORK_SCHEMATIC.points[a] && NETWORK_SCHEMATIC.points[b]);
const connected = new Set(MAP_EDGES.flat());
// Each piece of track in the colours of the services using it (see networkColours.ts).
const SERVICES_BY_TRACK = servicesByTrack(TRACK.filter(([a, b]) => NETWORK_SCHEMATIC.points[a] && NETWORK_SCHEMATIC.points[b] || pairKey(a, b) === pairKey('BBRHY', 'RCREA')), isNorthern);
const LEGEND: MapService[] = ['dart', 'commuter', 'intercity', 'cork', 'enterprise', 'ni'];
const MAP_CODES = [...connected];
const degree = new Map<string, number>();
for (const [a, b] of MAP_EDGES) for (const c of [a, b]) degree.set(c, (degree.get(c) ?? 0) + 1);
/** Mid-line stations where a service's line ends while the track goes on (DART at Malahide, NI Railways at Newry). */
const SERVICE_ENDS = new Set(
  MAP_CODES.filter((code) => {
    const lists = MAP_EDGES.filter((e) => e.includes(code)).map(([a, b]) => SERVICES_BY_TRACK.get(pairKey(real(a), real(b))) ?? []);
    return lists.length === 2 && lists.flat().some((s) => lists.filter((l) => l.includes(s)).length === 1);
  }),
);
// Circles for ends of lines, junctions, termini and where a service ends, ticks for the rest.
const major = (code: string) => degree.get(code) !== 2 || NETWORK_TERMINI.has(code) || SERVICE_ENDS.has(code);

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

/** Every station in Ireland as one schematic, fitting the screen's width and scrolling down. */
export function NetworkMap({ onBack, onSelectStation }: Props) {
  const { t, lang } = useI18n();
  const name = useNetworkName();
  const scrollRef = useScrollMemory<HTMLDivElement>('map:network');
  // Irish names are longer and wrap onto more lines, so the Irish map is taller.
  const schematic = useMemo(() => networkSchematic(lang), [lang]);
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchStations(query, SEARCHABLE) : [];
  // Every station opens its board; Northern Ireland ones without live times show NI Railways' timetable there.
  const open = (code: string) => onSelectStation(real(code), name(real(code)));

  return (
    <div className="screen network">
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

      <div className="screen__scroll" ref={scrollRef}>
        {query.trim() ? (
          <ul className="station-list">
            {results.map((s) => (
              <li key={s.code} className="station-row">
                {hasNoData(s.code) ? (
                  <button className="station-row__name station-row__name--no-data" onClick={() => open(s.code)}>
                    {name(s.code)} <span className="network__no-data-note">· {t.timetableOnly}</span>
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
                  {s === 'ni' ? `${t.niRailways} (${t.timetableOnly})` : t.serviceNames[s]}
                </li>
              ))}
            </ul>
            <PositionedMap
              schematic={schematic}
              edges={MAP_EDGES}
              codes={MAP_CODES}
              name={(code) => withBreaks(name(real(code)))}
              major={major}
              colourOf={(a, b) => trackColours(SERVICES_BY_TRACK, real(a), real(b))}
              onSelect={open}
              noData={hasNoData}
              className="schematic--compact schematic--network"
              label={t.allStations}
            />
            <p className="network__unmapped">
              <em>{t.italicStations}</em> {t.timetableOnlyNote}
            </p>
            {NOT_DRAWN.length > 0 && (
              <p className="network__unmapped">
                {t.notDrawnYet}: {NOT_DRAWN.map((code) => name(code)).join(', ')}
              </p>
            )}
          </>
        )}

      </div>
    </div>
  );
}
