import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import {
  adjacentStations,
  type Departure,
  delaySeverity,
  departuresGoingTo,
  type Direction,
  directionBetween,
  hasLiveData,
  irishSecondsOfDay,
  scheduledBeyondLive,
  scheduledHeading,
  type Service,
  type Station,
  terminiFrom,
} from '@dart-times/core';
import { formatTime, useNow } from '../lib/clock';
import { DeparturesSheet } from '../components/DeparturesSheet';
import { JOURNEY_CLOSE_MS, type JourneyOrigin, JourneyView, RETURN_FADE_DELAY_MS, RETURN_FADE_MS } from '../components/JourneyView';
import { TrainGlyph } from '../components/TrainGlyph';
import { DueIn } from '../components/DueIn';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { getGoingTo, setGoingTo } from '../lib/prefs';
import { useDepartures } from '../lib/useDepartures';
import { type TimetabledDeparture, useScheduled } from '../lib/useScheduled';
import { useMediaQuery } from '../lib/useMediaQuery';

/** Trains shown on each track; very short screens (e.g. 320×568 phones) only fit two above the "more" link. */
const TRAINS_PER_DIRECTION = 3;
const TRAINS_PER_DIRECTION_SHORT = 2;
const SHORT_SCREEN = '(max-height: 600px)';
/** Data refreshes every 30s; older than this and something's wrong (e.g. no signal). */
const STALE_AFTER_MS = 90_000;

interface Props {
  service: Service;
  station: Station;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onChangeStation: () => void;
  onSelectStation: (code: string) => void;
}

/**
 * The station on a double track: northbound (green) on the left, coming up from the bottom;
 * southbound (orange) on the right, coming down from the top. Nearest trains sit closest to the station.
 */
export function TrackView({ service, station, isFavourite, onToggleFavourite, onChangeStation, onSelectStation }: Props) {
  const { t, stationName, nameOf, list } = useI18n();
  // NI Railways has no live data: its trains come from the timetable, and only stations where the Enterprise
  // calls (Grand Central, Portadown, Newry) have live trains, which come from every Irish Rail train there.
  const nir = service.id === 'nir';
  const liveStation = !nir || hasLiveData(station.code);
  const { data, error } = useDepartures(station.code, nir ? 'all' : service.id, liveStation);
  const timetable = useScheduled(station.code, true, nir);
  const { line } = service;
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);
  const stale = !!fetchedAt && now.getTime() - fetchedAt.getTime() > STALE_AFTER_MS;

  // "Going to": remembered per station. It sets the direction, dims the other track and hides trains that won't get you there.
  const goingToKey = `${service.id}:${station.code}`;
  const [goingTo, setGoingToState] = useState(() => {
    const saved = getGoingTo(goingToKey);
    return saved && directionBetween(station.code, saved, line) ? saved : undefined;
  });
  const chooseGoingTo = (code: string | undefined) => {
    setGoingToState(code);
    setGoingTo(goingToKey, code);
  };
  const goingDirection = goingTo ? directionBetween(station.code, goingTo, line) : undefined;
  // The full departures panel for one direction; it's also where the going-to filter is chosen.
  const [sheetDirection, setSheetDirection] = useState<Direction>();
  // The look-ahead for one approaching train (tap a train); `closing` while it animates away.
  const [journey, setJourney] = useState<{ train: Departure; direction: Direction; origin?: JourneyOrigin }>();
  const [closingJourney, setClosingJourney] = useState(false);
  const closeJourney = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setJourney(undefined);
    setClosingJourney(true);
    setTimeout(() => {
      setJourney(undefined);
      setClosingJourney(false);
    }, JOURNEY_CLOSE_MS);
  }, []);
  // Where the train's track and the train itself are on the station page right now (for the glide back).
  const returnTo = useCallback(() => {
    if (!journey) return undefined;
    const lane = document.querySelector(journey.direction === 'Northbound' ? '.half--bottom .lane--north' : '.half--top .lane--south');
    const glyph = document.querySelector(`.train[data-train="${CSS.escape(journey.train.trainCode)}"] .train__glyph`);
    return { lane: lane?.getBoundingClientRect(), glyph: glyph?.getBoundingClientRect() };
  }, [journey]);
  const openJourney = (train: Departure, direction: Direction, glyph: Element | null) => {
    // Northbound trains come up the green track in the bottom half; southbound down the orange one at the top.
    const lane = document.querySelector(direction === 'Northbound' ? '.half--bottom .lane--north' : '.half--top .lane--south');
    setJourney({
      train,
      direction,
      origin: glyph && lane ? { glyph: glyph.getBoundingClientRect(), lane: lane.getBoundingClientRect() } : undefined,
    });
  };

  // Direction from our own line layout (here → the train's destination), so services whose API directions
  // read "To Cork" rather than Northbound/Southbound still land on the right track. Falls back to the API.
  const directionOf = (d: { destinationCode?: string; direction: string }) =>
    (d.destinationCode && directionBetween(station.code, d.destinationCode, line)) || d.direction;
  const allIn = (direction: Direction) => data?.departures.filter((d) => directionOf(d) === direction) ?? [];
  const shownIn = (direction: Direction) =>
    goingTo && goingDirection === direction ? departuresGoingTo(allIn(direction), station.code, goingTo, line) : allIn(direction);
  const dimmed = (direction: Direction) => !!goingDirection && goingDirection !== direction;
  const goingToName = goingTo && nameOf(goingTo);
  const name = stationName(station);

  // This page is laid out to fit one screen, so the page itself never scrolls (the "more" sheet scrolls inside).
  useEffect(() => {
    document.documentElement.classList.add('scroll-locked');
    return () => document.documentElement.classList.remove('scroll-locked');
  }, []);

  const perDirection = useMediaQuery(SHORT_SCREEN) ? TRAINS_PER_DIRECTION_SHORT : TRAINS_PER_DIRECTION;
  const nowMinutes = Math.floor(irishSecondsOfDay(now.getTime()) / 60);
  const liveCodes = new Set(data?.departures.map((d) => d.trainCode));
  // An NIR page also lists the Enterprise's timetabled trains, as its board did.
  const timetabledServices: TimetabledServices = nir ? ['nir', 'enterprise'] : service.id;
  const trainsFor = (direction: Direction, ends: string[]) => {
    const hidden = dimmed(direction);
    const live = hidden ? [] : shownIn(direction);
    const timetabled =
      timetable && !hidden
        ? scheduledBeyondLive(timetable, {
            nowMinutes,
            liveCodes,
            include: (d) =>
              scheduledHeading(d, {
                service: timetabledServices,
                station: station.code,
                direction,
                line,
                goingTo: goingDirection === direction ? goingTo : undefined,
              }),
          })
        : [];
    // Live and timetabled trains in time order. Irish Rail's timetabled trains are beyond the live window, so they
    // always follow the live ones; NI Railways' (no live data) fall in among the Enterprise's live trains.
    const all: TrackTrain[] = [
      ...live.map((d): TrackTrain => ({ live: d, at: nowMinutes + d.dueInMins })),
      ...timetabled.map((d): TrackTrain => ({ timetabled: d, at: d.minutes })),
    ].sort((a, b) => a.at - b.at);
    const items = all.slice(0, perDirection);
    const isToday = (x: TrackTrain) => !x.timetabled?.tomorrow;
    // "+ N more": live trains beyond those shown; on an NIR page, the rest of today's trains.
    const moreCount = hidden ? 0 : nir ? all.filter(isToday).length - items.filter(isToday).length : Math.max(0, live.length - perDirection);
    return (
      <Trains
        direction={direction}
        items={items}
        nir={nir}
        liveStation={liveStation}
        moreCount={moreCount}
        onMore={() => setSheetDirection(direction)}
        ends={ends}
        goingToName={goingDirection === direction ? goingToName : undefined}
        hidden={hidden}
        hasData={liveStation ? !!data : !!timetable}
        onOpen={(train, glyph) => openJourney(train, direction, glyph)}
      />
    );
  };

  // South of Belfast every NIR train northbound goes through Grand Central: name it, not all four branch ends.
  const viaBelfast = (ends: string[]) => (nir && ends.includes('BFSTC') ? ['BFSTC'] : ends);
  const north = viaBelfast(terminiFrom(station.code, 'Northbound', line));
  const south = viaBelfast(terminiFrom(station.code, 'Southbound', line));
  const neighbours = adjacentStations(station.code, line);

  return (
    <div className="track-view">
      <header className="track-view__bar">
        {/* Back to "Stations" as soon as closing starts, while the track and train are still gliding back. */}
        {journey && !closingJourney ? (
          <button className="chip" onClick={closeJourney}>
            ✕ {t.journey.close}
          </button>
        ) : (
          <button className="chip" onClick={onChangeStation}>
            ‹ {t.stations}
          </button>
        )}
        <div className="clock">
          <p className="clock__now">
            <span className="clock__label">{t.now}</span> <time>{formatTime(now)}</time>
          </p>
          <p className={`clock__updated${error || stale ? ' clock__updated--stale' : ''}`} role="status">
            {fetchedAt ? (
              <>
                {t.updated} <time>{formatTime(fetchedAt, true)}</time>
                {error && ` · ${t.retrying}`}
              </>
            ) : (
              (error ?? (liveStation ? t.loading : t.timetableOnly))
            )}
          </p>
        </div>
        <div className="track-view__actions">
          <OptionsMenu />
          <button
            className={`star${isFavourite ? ' star--on' : ''}`}
            onClick={onToggleFavourite}
            aria-pressed={isFavourite}
            aria-label={isFavourite ? t.removeFavourite(name) : t.addFavourite(name)}
          >
            {isFavourite ? '★' : '☆'}
          </button>
        </div>
      </header>

      <div
        className={`tracks${journey && !closingJourney ? ' tracks--journey' : ''}${closingJourney ? ' tracks--returning' : ''}`}
        style={{ '--return-fade-delay': `${RETURN_FADE_DELAY_MS}ms`, '--return-fade-ms': `${RETURN_FADE_MS}ms` } as CSSProperties}
      >
        {/* Top half: southbound trains on their way in, nearest at the bottom. Green arrow continues up to its termini. */}
        <section className="half half--top" aria-label={t.towards(t.direction.Southbound, list(south.map(nameOf)))}>
          {/* Orange runs edge to edge through its trains; green carries on past the platform to its arrowhead halfway up. */}
          {north.length > 0 && <Lane direction="Northbound" withHead dimmed={dimmed('Northbound')} />}
          <Lane direction="Southbound" dimmed={dimmed('Southbound')} />
          <p className={`terminus terminus--north${dimmed('Northbound') ? ' terminus--dimmed' : ''}`} aria-hidden>
            <Termini codes={north} />
          </p>
          {trainsFor('Southbound', south)}
        </section>

        <div className="platform">
          <Neighbours codes={neighbours.north} direction="north" onSelect={onSelectStation} />
          <div className="platform__middle">
            {/* Some Irish names are long; step the size down so they fit on one line on a phone. */}
            <h1 className={`platform__name${name.length > 20 ? ' platform__name--longer' : name.length > 13 ? ' platform__name--long' : ''}`}>
              <Caps text={name} />
            </h1>
            <OfficialName station={station} />
            {/* Only shown while a filter is on: tap the name to change it in that direction's panel, ✕ to clear. */}
            {goingTo && goingDirection && (
              <div className="going-to">
                <button className="going-to__name" onClick={() => setSheetDirection(goingDirection)}>
                  {goingDirection === 'Northbound' ? '↑' : '↓'} <Caps text={t.goingTo(goingToName!)} />
                </button>
                <button className="going-to__clear" onClick={() => chooseGoingTo(undefined)} aria-label={t.showAll}>
                  ✕
                </button>
              </div>
            )}
          </div>
          <Neighbours codes={neighbours.south} direction="south" onSelect={onSelectStation} />
        </div>

        {/* Bottom half: northbound trains on their way in, nearest at the top. Orange arrow continues down to its termini. */}
        <section className="half half--bottom" aria-label={t.towards(t.direction.Northbound, list(north.map(nameOf)))}>
          {/* Green runs edge to edge through its trains; orange carries on past the platform to its arrowhead halfway down. */}
          <Lane direction="Northbound" dimmed={dimmed('Northbound')} />
          {south.length > 0 && <Lane direction="Southbound" withHead dimmed={dimmed('Southbound')} />}
          {trainsFor('Northbound', north)}
          <p className={`terminus terminus--south${dimmed('Southbound') ? ' terminus--dimmed' : ''}`} aria-hidden>
            <Termini codes={south} />
          </p>
        </section>

        {journey && (
          <JourneyView
            key={journey.train.trainCode}
            train={journey.train}
            direction={journey.direction}
            stationCode={station.code}
            origin={journey.origin}
            returnTo={returnTo}
            closing={closingJourney}
            onClose={closeJourney}
          />
        )}
      </div>

      {sheetDirection && (
        <DeparturesSheet
          station={station}
          line={line}
          serviceId={service.id}
          live={liveStation}
          direction={sheetDirection}
          departures={allIn(sheetDirection)}
          goingTo={goingDirection === sheetDirection ? goingTo : undefined}
          onGoingTo={chooseGoingTo}
          onClose={() => setSheetDirection(undefined)}
        />
      )}
    </div>
  );
}

/**
 * The station's official name under the sign, e.g. "Kent Station" under CORK. English only for now: in Irish
 * these names change form (Stáisiún Cheannt, Stáisiún Uí Chléirigh…), which needs checking by a fluent speaker.
 */
export function OfficialName({ station }: { station?: Station }) {
  const { lang } = useI18n();
  if (!station?.officialName || lang !== 'en') return null;
  return <p className="platform__official">{station.officialName}</p>;
}

/** Links to the next station(s) along the line: north above the station name, south below it. */
function Neighbours({
  codes,
  direction,
  onSelect,
}: {
  codes: string[];
  direction: 'north' | 'south';
  onSelect: (code: string) => void;
}) {
  const { t, nameOf } = useI18n();
  // At a terminus the row stays, empty, so the station sign keeps its size.
  if (!codes.length) return <div className="neighbours" aria-hidden />;
  return (
    <nav className={`neighbours neighbours--${direction}`} aria-label={t.nextStation[direction]}>
      {codes.map((code) => (
        <button key={code} className="neighbour" onClick={() => onSelect(code)}>
          {direction === 'north' ? '↑' : '↓'} <Caps text={nameOf(code)} />
        </button>
      ))}
    </nav>
  );
}

function Termini({ codes }: { codes: string[] }) {
  const { t, nameOf } = useI18n();
  if (!codes.length) return null;
  return (
    <>
      <span className="terminus__to">{t.to}</span>
      {codes.map(nameOf).map((name) => (
        <span key={name}>
          <Caps text={name} />
        </span>
      ))}
    </>
  );
}

/**
 * One half's piece of a track. Where trains approach it runs the full height of the half. In the
 * half trains leave towards, it runs from the platform and ends in the arrowhead halfway along: the
 * line stops at the head's base so it never shows through the point. At a terminus that piece is
 * left out, so the track stops at the platform.
 */
function Lane({ direction, withHead = false, dimmed }: { direction: Direction; withHead?: boolean; dimmed: boolean }) {
  const side = direction === 'Northbound' ? 'north' : 'south';
  return (
    <div className={`lane lane--${side}${withHead ? ' lane--departing' : ''}${dimmed ? ' lane--dimmed' : ''}`} aria-hidden>
      <div className="lane__shaft" />
      {withHead && <div className="lane__head" />}
    </div>
  );
}

type TimetabledServices = Parameters<typeof scheduledHeading>[1]['service'];

/** One place on a track: a live train, or a timetabled one, with when it leaves (minutes after today's midnight). */
type TrackTrain = { live: Departure; timetabled?: undefined; at: number } | { live?: undefined; timetabled: TimetabledDeparture; at: number };

function Trains({
  direction,
  items,
  nir,
  liveStation,
  moreCount,
  onMore,
  ends,
  goingToName,
  hidden,
  hasData,
  onOpen,
}: {
  direction: Direction;
  /** Live and timetabled trains, in time order, as many as fit. */
  items: TrackTrain[];
  /** An NI Railways page: timetabled trains are the norm, not a stand-in for live ones. */
  nir: boolean;
  /** False for NI Railways stations with no live trains at all: their timetabled trains are drawn solid. */
  liveStation: boolean;
  /** Departures beyond the ones shown. The link to the full list (and its filters) shows either way. */
  moreCount: number;
  onMore: () => void;
  ends: string[];
  goingToName?: string;
  /** The other direction to where you're going: its track is dimmed and shows no trains. */
  hidden: boolean;
  /** False while loading or after a failed first load; the status bar says which. */
  hasData: boolean;
  /** Tap a train for its look-ahead; gets the train's drawing so the view can start from it. */
  onOpen: (train: Departure, glyph: Element | null) => void;
}) {
  const { t, destinationName, scheduledDestination, describe } = useI18n();
  const side = direction === 'Northbound' ? 'north' : 'south';
  if (!hasData || hidden) return null;

  // A note by the platform. Live services: nothing live this way in the live window. NI Railways: no more trains
  // today (tomorrow's first ones follow), or none in the timetable at all.
  const anyLive = items.some((x) => x.live);
  const noneToday = items.length > 0 && items.every((x) => x.timetabled?.tomorrow);
  let message: string | undefined;
  if (!ends.length && !items.length) message = t.terminateHere;
  else if (nir) message = !items.length ? t.noTimetabledTrains : noneToday ? t.noMoreToday : undefined;
  else if (!anyLive) message = goingToName ? t.noTrainsTo(goingToName) : t.noTrains(t.direction[direction]);
  const note = message && <p className={`trains-empty trains-empty--${side}`}>{message}</p>;
  if (!items.length) return note || null;
  // The note takes a train's room: with it, one train fewer fits on a phone (the rest are under "+ N more").
  const shown = note && items.length > 1 ? items.slice(0, -1) : items;
  const more = (
    <button className={`more more--${side}`} onClick={onMore}>
      {moreCount + items.length - shown.length > 0 ? t.more(moreCount + items.length - shown.length) : t.filter}
    </button>
  );
  // Southbound lists run bottom-up (nearest by the platform), so the link goes at the far end: the top.
  return (
    <>
      {side === 'south' && more}
      {side === 'north' && note}
      <ol className={`trains trains--${side}`}>
        {shown.map(({ live: d, timetabled: s }, i) =>
          d ? (
            <li key={d.trainCode} data-train={d.trainCode} className={`train train--${side}${i === 0 ? ' train--next' : ''}`} aria-label={describe(d)}>
              {/* The whole row opens the train's look-ahead. */}
              <button
                className="train__open"
                aria-label={t.journey.open(destinationName(d))}
                onClick={(e) => onOpen(d, e.currentTarget.parentElement?.querySelector('.train__glyph') ?? null)}
              />
              <TrainGlyph />
              <div className="train__info">
                <span className={`train__due${d.dueInMins <= 0 ? ' train__due--now' : ''}`}>
                  {d.dueInMins <= 0 ? t.due : <DueIn mins={d.dueInMins} />}
                </span>
                <span className={`train__dest${destinationName(d).length > 12 ? ' train__dest--long' : ''}`}>
                  <Caps text={destinationName(d)} />
                </span>
                {/* Late: scheduled time struck through, the delay, then the expected time (delay already included). */}
                <span className="train__meta">
                  {d.lateMins > 0 ? (
                    <>
                      <s className="train__scheduled">{d.scheduledDepart}</s>
                      <span className={`late late--${delaySeverity(d.lateMins)}`}>+{d.lateMins}</span>
                      <span className="train__expected">{d.expectedDepart}</span>
                    </>
                  ) : (
                    d.expectedDepart
                  )}
                </span>
              </div>
            </li>
          ) : (
            <TimetabledTrain key={`${s!.trainCode}-${s!.minutes}`} d={s!} side={side} next={i === 0 && !liveStation} hollow={liveStation} />
          ),
        )}
      </ol>
      {side === 'south' && note}
      {side === 'north' && more}
    </>
  );
}

/**
 * A timetabled train: no live position or journey, so it can't be opened. NI Railways trains (never live) show
 * their clock time, since a countdown would look live; Irish Rail's, beyond the live window, a countdown. Hollow
 * among live trains, solid at stations with none.
 */
function TimetabledTrain({ d, side, next, hollow }: { d: TimetabledDeparture; side: 'north' | 'south'; next: boolean; hollow: boolean }) {
  const { t, scheduledDestination } = useI18n();
  const now = useNow();
  const clock = d.category === 'nir';
  const destination = scheduledDestination(d);
  return (
    <li
      className={`train train--${side}${next ? ' train--next' : ''}${hollow ? ' train--scheduled' : ''}`}
      aria-label={`${t.describeScheduled(destination, d.time)}${d.tomorrow ? `, ${t.tomorrow}` : ''}`}
    >
      <TrainGlyph />
      <div className="train__info">
        <span className={`train__due${clock ? ' train__due--clock' : ''}`}>
          {clock ? d.time : <DueIn mins={d.minutes - Math.floor(irishSecondsOfDay(now.getTime()) / 60)} />}
        </span>
        <span className={`train__dest${destination.length > 12 ? ' train__dest--long' : ''}`}>
          <Caps text={destination} />
        </span>
        <span className="train__meta">
          {/* Tomorrow's trains can only be timetabled, so that tag says both (two tags don't fit beside the track). */}
          <span className="train__timetable">{d.tomorrow ? t.tomorrow : t.timetabled}</span>
          {!clock && <span className="train__planned">{d.time}</span>}
        </span>
      </div>
    </li>
  );
}
