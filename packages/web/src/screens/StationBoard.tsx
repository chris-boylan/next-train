import { useRef } from 'react';
import {
  commuterHeading,
  delaySeverity,
  type Departure,
  findStationByCode,
  intercityHeading,
  irishSecondsOfDay,
  isCityStation,
  route as routeBetween,
  scheduledMatches,
  type ServiceId,
  type TrainCategory,
} from '@dart-times/core';
import { formatTime, useNow } from '../lib/clock';
import { COMMUTER_ROUTE_MAP } from '../maps/data/commuterRoutes';
import { INTERCITY_ROUTE_MAP } from '../maps/data/intercityRoutes';
import { DueIn } from '../components/DueIn';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { OfficialName, TracksIcon } from './TrackView';
import { useDepartures } from '../lib/useDepartures';
import { useScheduled } from '../lib/useScheduled';
import { leaveBoard } from '../lib/viewSwitch';
import { LaterDepartures } from '../components/LaterDepartures';

interface Props {
  code: string;
  name: string;
  /** "all": every train at the station, grouped by the API's direction. "commuter" and "intercity": that
   *  service's trains only, grouped by route and direction (e.g. "Northern · towards Dundalk"). */
  mode: 'all' | ServiceId;
  backLabel: string;
  onBack: () => void;
  favourite?: { on: boolean; toggle: () => void };
  /** False for stations with no live data at all (most NI Railways stations): nothing is fetched. */
  live?: boolean;
  /** A note above the departures, e.g. that NI Railways trains aren't included. */
  note?: string;
  /** The tracks button by the station name: show this station on its two tracks instead. */
  onShowTracks?: () => void;
  /** Arrived from the station's tracks: the list fades in, then `onEntered`. */
  entering?: boolean;
  onEntered?: () => void;
}

interface Group {
  key: string;
  label: string;
  colour?: string;
  departures: Departure[];
}

/** A station's departures in the next 90 minutes, as a board grouped by direction (or route and direction). */
export function StationBoard({ code, name, mode, backLabel, onBack, favourite, live = true, note, onShowTracks, entering = false, onEntered }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const showTracks = async () => {
    if (!onShowTracks || !rootRef.current) return;
    await leaveBoard(rootRef.current);
    onShowTracks();
  };
  const { t, nameOf, destinationName, describe } = useI18n();
  const scheduled = useScheduled(code);
  // NI Railways trains are timetable-only, from now: the section is "Timetable", not "Later".
  const hasNir = !!scheduled?.some((d) => d.category === 'nir');
  const { data, error } = useDepartures(code, mode, live);
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);

  const directionLabel = (direction: string) => {
    if (direction === 'Northbound' || direction === 'Southbound') return t.direction[direction];
    // The API's other directions read "To Galway"; keep the place, translate the "to".
    return direction.replace(/^To\s+/i, `${t.to} `);
  };

  // Route groups. Commuter outbound reads "towards Maynooth / M3 Parkway" and inbound "towards Dublin",
  // except at a city-centre station. Intercity routes branch and cross the country, so their groups always
  // name where the trains are going ("Limerick & Ennis · towards Ennis"), as do city-centre commuter groups.
  const inCity = isCityStation(code);
  const groupOf = (d: Departure): { key: string; route?: string; towards?: string; colour?: string } => {
    if (mode === 'commuter') {
      const heading = commuterHeading(code, d);
      if (heading) {
        const towards = heading.outbound ? heading.route.outer.map(nameOf).join(' / ') : inCity ? undefined : t.dublin;
        return {
          key: `${heading.route.id}:${heading.outbound}`,
          route: t.commuterRoutes[heading.route.id],
          towards,
          colour: COMMUTER_ROUTE_MAP.colour(heading.route.id),
        };
      }
    }
    if (mode === 'intercity') {
      const heading = intercityHeading(code, d);
      if (heading) {
        // Grouped by the next station, so trains leaving in different directions (Mallow to Cork and to
        // Tralee) get their own groups even when both run away from Dublin.
        const next = routeBetween(code, d.destinationCode!, heading.route.line)?.[1];
        return {
          key: `${heading.route.id}:${next}`,
          route: t.intercityRoutes[heading.route.id],
          colour: INTERCITY_ROUTE_MAP.colour(heading.route.id),
        };
      }
    }
    return { key: d.direction, towards: directionLabel(d.direction) };
  };

  const groups = new Map<string, Group>();
  for (const d of data?.departures ?? []) {
    const { key, route, towards, colour } = groupOf(d);
    const departures = [...(groups.get(key)?.departures ?? []), d];
    if (!route) {
      groups.set(key, { key, label: towards!, colour, departures });
      continue;
    }
    // Groups without a fixed destination name the places their trains are going.
    const places = towards ?? [...new Set(departures.map(destinationName))].join(' / ');
    groups.set(key, { key, label: `${route} · ${t.towards2(places)}`, colour, departures });
  }

  return (
    <div className={`screen board${entering ? ' board--entering' : ''}`} ref={rootRef} onAnimationEnd={(e) => entering && e.target !== e.currentTarget && onEntered?.()}>
      <header className="track-view__bar">
        <button className="chip" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <div className="clock">
          <p className="clock__now">
            <span className="clock__label">{t.now}</span> <time>{formatTime(now)}</time>
          </p>
          <p className={`clock__updated${error ? ' clock__updated--stale' : ''}`} role="status">
            {fetchedAt ? (
              <>
                {t.updated} <time>{formatTime(fetchedAt, true)}</time>
                {error && ` · ${t.retrying}`}
              </>
            ) : (
              (error ?? (live ? t.loading : t.timetableOnly))
            )}
          </p>
        </div>
        <div className="track-view__actions">
          {favourite && (
            <button
              className={`star${favourite.on ? ' star--on' : ''}`}
              onClick={favourite.toggle}
              aria-pressed={favourite.on}
              aria-label={favourite.on ? t.removeFavourite(name) : t.addFavourite(name)}
            >
              {favourite.on ? '★' : '☆'}
            </button>
          )}
          <OptionsMenu />
        </div>
      </header>

      <div className="screen__scroll">
        <div className="board__sign">
          <h1 className={`platform__name${name.length > 20 ? ' platform__name--longer' : name.length > 13 ? ' platform__name--long' : ''}`}>
            {onShowTracks ? (
              <button className="platform__switch" onClick={showTracks} aria-label={`${name}: ${t.showOnTracks}`} title={t.showOnTracks}>
                <Caps text={name} />
                <TracksIcon />
              </button>
            ) : (
              <Caps text={name} />
            )}
          </h1>
          <OfficialName station={findStationByCode(code)} />
        </div>

        <div className="board__body">
          {note && <p className="board__note">{note}</p>}
          {data && !data.departures.length && <p className="sheet__empty">{t.noTrainsAnyDirection}</p>}
          {[...groups.values()].map((group) => (
            <section key={group.key} className="board__group">
              <h2 className="destinations__heading" style={group.colour ? { borderBottomColor: group.colour } : undefined}>
                {group.colour && <span className="board__route-swatch" style={{ background: group.colour }} />}
                <Caps text={group.label} />
              </h2>
              <ol className="departure-list">
                {group.departures.map((d) => (
                  <li key={d.trainCode} className="departure-row board__row" aria-label={describe(d)}>
                    <span className={`departure-row__due${d.dueInMins <= 0 ? ' departure-row__due--now' : ''}`}>
                      {d.dueInMins <= 0 ? t.due : <DueIn mins={d.dueInMins} />}
                    </span>
                    <span className="board__what">
                      <span className="departure-row__dest">
                        <Caps text={destinationName(d)} />
                      </span>
                      {mode === 'all' && <CategoryBadge category={d.category} />}
                    </span>
                    <span className="departure-row__time">
                      {d.lateMins > 0 && (
                        <>
                          <s className="train__scheduled">{d.scheduledDepart}</s>
                          <span className={`late late--${delaySeverity(d.lateMins)}`}>+{d.lateMins}</span>
                        </>
                      )}
                      <span className="train__expected">{d.expectedDepart}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {/* Stations with no live data at all (most of NI Railways) show the timetable straight away. */}
          {scheduled && (data || !live) && (
            <LaterDepartures
              departures={scheduled}
              nowMinutes={Math.floor(irishSecondsOfDay(now.getTime()) / 60)}
              liveCodes={new Set(data?.departures.map((d) => d.trainCode))}
              include={(d) => mode === 'all' || scheduledMatches(mode, d)}
              showCategory={mode === 'all'}
              limit={hasNir ? 15 : undefined}
              title={hasNir ? t.timetable : undefined}
              // Said once: in the board's note when there is one (NI Railways stations), else here.
              note={hasNir ? (note ? null : t.nirTimetableNote) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: TrainCategory }) {
  const { t } = useI18n();
  return <span className={`badge badge--${category}`}>{t.categories[category]}</span>;
}
