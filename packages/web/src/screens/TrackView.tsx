import { type CSSProperties, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollingName } from '../components/ScrollingName';
import {
  adjacentStations,
  callsAt,
  type Departure,
  delaySeverity,
  departuresGoingTo,
  type Direction,
  directionBetween,
  hasCompassDirections,
  hasLiveData,
  irishSecondsOfDay,
  placeDeparture,
  placeTimetabled,
  scheduledBeyondLive,
  type ScheduledDeparture,
  type Service,
  type Placement,
  stationLines,
  allRoutesLine,
  trackOnAll,
  type Station,
  terminiFrom,
  LIVE_WINDOW_MINS,
  SERVICES,
  type ServiceId,
  type TrainCategory,
} from '@dart-times/core';
import { formatTime, useNow } from '../lib/clock';
import { DeparturesSheet } from '../components/DeparturesSheet';
import { Sheet } from '../components/Sheet';
import { JOURNEY_CLOSE_MS, type JourneyOrigin, JourneyView, RETURN_FADE_DELAY_MS, RETURN_FADE_MS } from '../components/JourneyView';
import { TrainGlyph } from '../components/TrainGlyph';
import { DueIn } from '../components/DueIn';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { getGoingTo, setGoingTo } from '../lib/prefs';
import { useDepartures } from '../lib/useDepartures';
import { type TimetabledDeparture, useScheduled } from '../lib/useScheduled';
import { useMediaQuery } from '../lib/useMediaQuery';
import { enterTracks, leaveTracks } from '../lib/viewSwitch';
import { COMMUTER_ROUTE_MAP } from '../maps/data/commuterRoutes';
import { INTERCITY_ROUTE_MAP } from '../maps/data/intercityRoutes';

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
  /** At a station on several lines (Commuter hubs), the one to open on: the route picked on the map. */
  initialLineId?: string;
  /** The list button by the station name: show this station as a board instead. */
  onShowBoard?: () => void;
  /** Arrived from the station's board (its tracks button): play the transition in, then call `onEntered`. */
  enterFromBoard?: boolean;
  onEntered?: () => void;
}

/**
 * The station on a double track: northbound (green) on the left, coming up from the bottom;
 * southbound (orange) on the right, coming down from the top. Nearest trains sit closest to the station.
 */
export function TrackView({
  service,
  station,
  isFavourite,
  onToggleFavourite,
  onChangeStation,
  onSelectStation,
  initialLineId,
  onShowBoard,
  enterFromBoard = false,
  onEntered,
}: Props) {
  const { t, stationName, nameOf, list, scheduledDestination } = useI18n();
  // NI Railways has no live data: its trains come from the timetable, and only stations where the Enterprise
  // calls (Grand Central, Portadown, Newry) have live trains, which come from every Irish Rail train there.
  const nir = service.id === 'nir';
  const liveStation = !nir || hasLiveData(station.code);
  const { data, error } = useDepartures(station.code, nir ? 'all' : service.id, liveStation);
  // Tomorrow's timetable too, so a page after the last train shows the first one in the morning (Sligo after 19:05).
  const timetable = useScheduled(station.code, true, true);
  // The station's lines: one, or one per route at a Commuter hub (chosen with the chips under the header).
  const lines = useMemo(() => stationLines(service, station.code), [service, station.code]);
  // At a hub (several routes), "All" first: every route's trains on one pair of tracks. A route picked on the
  // map (initialLineId) opens on that route instead.
  const all = useMemo(() => allRoutesLine(lines, station.code), [lines, station.code]);
  const options = useMemo(() => (all ? [all, ...lines] : lines), [all, lines]);
  const [lineId, setLineId] = useState(() => options.find((l) => l.id === initialLineId)?.id ?? options[0]!.id);
  const current = options.find((l) => l.id === lineId) ?? options[0]!;
  const { line } = current;
  // Northbound/Southbound are compass directions on the DART, Enterprise, Cork and NIR; on Commuter routes they're
  // outbound and inbound, so tracks are named by where their trains go.
  const compass = hasCompassDirections(service.id);
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
  // A tapped timetabled train: a short note on why it shows its timetabled time.
  const [timetableInfo, setTimetableInfo] = useState<TimetabledDeparture>();
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

  // Each train's line and track from our own line layout (here → its destination), so services whose API
  // directions read "To Cork" still land on the right track, and Commuter trains on their route.
  const onTrack = (direction: Direction) => (p: Placement | undefined) =>
    current.id === 'all' && all ? trackOnAll(all, p) === direction : !!p && p.lineId === current.id && p.direction === direction;
  const allIn = (direction: Direction) => data?.departures.filter((d) => onTrack(direction)(placeDeparture(service, station.code, lines, d))) ?? [];
  const timetabledOn = (direction: Direction) => (d: ScheduledDeparture) => onTrack(direction)(placeTimetabled(service, station.code, lines, d));

  // Other services at this station (DART and Commuter share the coast, Commuter and InterCity Kildare...). When a
  // track has nothing of ours in the live window, every train here is loaded too, so the note can say which
  // service does run that way ("No Commuter trains towards Connolly... DART trains run this way").
  const sharedWith = useMemo(
    () => (Object.keys(SERVICES) as ServiceId[]).filter((id) => id !== service.id && id !== 'nir' && SERVICES[id].stations.some((s) => s.code === station.code)),
    [service.id, station.code],
  );
  const emptyTrack = !!data && (['Northbound', 'Southbound'] as const).some((d) => !allIn(d).length);
  const { data: everyTrain } = useDepartures(station.code, 'all', liveStation && !nir && sharedWith.length > 0 && emptyTrack);
  const othersIn = (direction: Direction): OtherServices | undefined => {
    if (!everyTrain) return undefined;
    const next = new Map<ServiceId, number>();
    const destinations: string[] = [];
    for (const d of everyTrain.departures) {
      const id = sharedWith.find((other) => SERVICE_CATEGORY[other] === d.category);
      if (!id) continue;
      const other = SERVICES[id];
      // Placed as that service's own page would: every page draws up as north, so the tracks line up.
      if (placeDeparture(other, station.code, stationLines(other, station.code), d)?.direction !== direction) continue;
      next.set(id, Math.min(next.get(id) ?? Infinity, d.dueInMins));
      const to = d.destinationCode ?? d.destination;
      if (!destinations.includes(to)) destinations.push(to);
    }
    return next.size ? { services: [...next.keys()], destinations, nextInMins: Math.min(...next.values()) } : undefined;
  };
  const directionName = (direction: Direction) =>
    compass ? t.direction[direction] : t.towards2(list(terminiFrom(station.code, direction, line).filter((end) => !passedThrough(end)).map(nameOf)));
  const shownIn = (direction: Direction) =>
    goingTo && goingDirection === direction ? departuresGoingTo(allIn(direction), station.code, goingTo, line) : allIn(direction);
  const dimmed = (direction: Direction) => !!goingDirection && goingDirection !== direction;
  const goingToName = goingTo && nameOf(goingTo);
  const name = stationName(station);

  // The switch to and from the board (see lib/viewSwitch.ts). Entering, the trains stay hidden until the tracks
  // are back; leaving, the board only takes over once the sign is in its place.
  const rootRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(enterFromBoard);
  const [leaving, setLeaving] = useState(false);
  // Once per page: React's development mode runs mount effects twice, and a second run would measure the sign
  // mid-move and override the first.
  const entered = useRef(false);
  useLayoutEffect(() => {
    if (!enterFromBoard || !rootRef.current || entered.current) return;
    entered.current = true;
    void enterTracks(rootRef.current, () => setEntering(false)).then(() => onEntered?.());
    // Once, as the page first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showBoard = async () => {
    if (!onShowBoard || leaving || journey || !rootRef.current) return;
    setLeaving(true);
    await leaveTracks(rootRef.current);
    onShowBoard();
  };

  const perDirection = useMediaQuery(SHORT_SCREEN) ? TRAINS_PER_DIRECTION_SHORT : TRAINS_PER_DIRECTION;
  const nowMinutes = Math.floor(irishSecondsOfDay(now.getTime()) / 60);
  const liveCodes = new Set(data?.departures.map((d) => d.trainCode));
  const trainsFor = (direction: Direction, ends: string[]) => {
    const hidden = dimmed(direction);
    const live = hidden ? [] : shownIn(direction);
    const timetabled =
      timetable && !hidden
        ? scheduledBeyondLive(timetable, {
            nowMinutes,
            liveCodes,
            include: (d) =>
              timetabledOn(direction)(d) &&
              (goingDirection !== direction || !goingTo || d.destinationCode === goingTo || callsAt(station.code, d.destinationCode!, goingTo, line)),
          }).filter(
            // Irish Rail: at most tomorrow's first train on a track, after today's; NI Railways lists the day ahead.
            (d, i, list) => nir || !(d as TimetabledDeparture).tomorrow || list.findIndex((x) => (x as TimetabledDeparture).tomorrow) === i,
          )
        : [];
    // Live and timetabled trains in time order. Irish Rail's timetabled trains are beyond the live window, so they
    // always follow the live ones; NI Railways' (no live data) fall in among the Enterprise's live trains.
    const all: TrackTrain[] = [
      ...live.map((d): TrackTrain => ({ live: d, at: nowMinutes + d.dueInMins })),
      ...timetabled.map((d): TrackTrain => ({ timetabled: d, at: d.minutes })),
    ].sort((a, b) => a.at - b.at);
    const items = all.slice(0, perDirection);
    const isToday = (x: TrackTrain) => !x.timetabled?.tomorrow;
    // The last train today on this track, when tomorrow's first follows it: the timetable is loaded and has
    // nothing more today (with timetabled trains off, or no file, nothing is called the last).
    const firstTomorrow = all.findIndex((x) => !isToday(x));
    const lastToday = firstTomorrow > 0 ? all[firstTomorrow - 1] : undefined;
    const lastTodayCode = lastToday && (lastToday.live?.trainCode ?? lastToday.timetabled?.trainCode);
    // "+ N more": live trains beyond those shown; on an NIR page, the rest of today's trains.
    const moreCount = hidden ? 0 : nir ? all.filter(isToday).length - items.filter(isToday).length : Math.max(0, live.length - perDirection);
    return (
      <Trains
        direction={direction}
        items={items}
        nir={nir}
        compass={compass}
        liveStation={liveStation}
        moreCount={moreCount}
        onMore={() => setSheetDirection(direction)}
        ends={ends}
        goingToName={goingDirection === direction ? goingToName : undefined}
        hidden={hidden}
        hasData={liveStation ? !!data : !!timetable}
        onOpen={(train, glyph) => openJourney(train, direction, glyph)}
        onTimetabled={setTimetableInfo}
        serviceId={service.id}
        others={hidden ? undefined : othersIn(direction)}
        lastTodayCode={lastTodayCode}
      />
    );
  };

  // South of Belfast every NIR train northbound goes through Grand Central: name it, not all four branch ends.
  const viaBelfast = (ends: string[]) => (nir && ends.includes('BFSTC') ? ['BFSTC'] : ends);
  // Where a track's trains go. Not the end of a line that doesn't come through here, when the lines that do run
  // straight past it: from Kildare, Ballybrophy (where the Nenagh line starts) and Limerick Junction aren't where
  // trains are going. Turn-backs (Hazelhatch) aren't line ends, and Limerick from Limerick Junction is one.
  const passedThrough = (end: string) => {
    const isEnd = (p: string[]) => p[0] === end || p.at(-1) === end;
    const throughHere = line.paths.filter((p) => p.includes(station.code) && p.includes(end));
    return line.paths.some(isEnd) && throughHere.length > 0 && !throughHere.some(isEnd);
  };
  const endsOf = (direction: Direction) => viaBelfast(terminiFrom(station.code, direction, line).filter((end) => !passedThrough(end)));
  const north = endsOf('Northbound');
  const south = endsOf('Southbound');
  const neighbours = adjacentStations(station.code, line);
  // Chips: each route's name and map colour.
  const routeNames: Record<string, string> = service.id === 'intercity' ? t.intercityRoutes : t.commuterRoutes;
  const lineName = (id: string) => routeNames[id] ?? id;
  const lineColour = (id: string) =>
    service.id === 'intercity'
      ? INTERCITY_ROUTE_MAP.colour(id as Parameters<typeof INTERCITY_ROUTE_MAP.colour>[0])
      : COMMUTER_ROUTE_MAP.colour(id as Parameters<typeof COMMUTER_ROUTE_MAP.colour>[0]);

  return (
    <div className={`track-view${entering ? ' track-view--entering' : ''}`} ref={rootRef}>
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
          <button
            className={`star${isFavourite ? ' star--on' : ''}`}
            onClick={onToggleFavourite}
            aria-pressed={isFavourite}
            aria-label={isFavourite ? t.removeFavourite(name) : t.addFavourite(name)}
          >
            {isFavourite ? '★' : '☆'}
          </button>
          <OptionsMenu />
        </div>
      </header>

      {options.length > 1 && (
        <nav className="line-chips" aria-label={t.lines}>
          {options.map((l) => (
            <button
              key={l.id}
              className={`line-chip${l.id === current.id ? ' line-chip--on' : ''}`}
              aria-pressed={l.id === current.id}
              onClick={() => setLineId(l.id)}
            >
              {/* "All" has every route's colour, side by side. */}
              <span
                className="line-chip__swatch"
                style={{
                  background:
                    l.id === 'all'
                      ? `linear-gradient(to right, ${lines.map((r, i) => `${lineColour(r.id)} ${(i / lines.length) * 100}% ${((i + 1) / lines.length) * 100}%`).join(', ')})`
                      : lineColour(l.id),
                }}
              />
              {l.id === 'all' ? t.allRoutesChip : lineName(l.id)}
            </button>
          ))}
        </nav>
      )}

      <div
        className={`tracks${journey && !closingJourney ? ' tracks--journey' : ''}${closingJourney ? ' tracks--returning' : ''}`}
        style={{ '--return-fade-delay': `${RETURN_FADE_DELAY_MS}ms`, '--return-fade-ms': `${RETURN_FADE_MS}ms` } as CSSProperties}
      >
        {/* Top half: southbound trains on their way in, nearest at the bottom. Green arrow continues up to its termini. */}
        <section className="half half--top" aria-label={compass ? t.towards(t.direction.Southbound, list(south.map(nameOf))) : directionName('Southbound')}>
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
              {onShowBoard ? (
                // The name switches the station to its list board (and the board's name switches back).
                <button className="platform__switch" onClick={showBoard} aria-label={`${name}: ${t.showAsList}`} title={t.showAsList}>
                  <ScrollingName text={name} />
                  <ListIcon />
                </button>
              ) : (
                <ScrollingName text={name} />
              )}
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
        <section className="half half--bottom" aria-label={compass ? t.towards(t.direction.Northbound, list(north.map(nameOf))) : directionName('Northbound')}>
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
          directionName={directionName(sheetDirection)}
          timetabledOn={timetabledOn(sheetDirection)}
          departures={allIn(sheetDirection)}
          goingTo={goingDirection === sheetDirection ? goingTo : undefined}
          onGoingTo={chooseGoingTo}
          onClose={() => setSheetDirection(undefined)}
        />
      )}

      {timetableInfo && (
        <Sheet title={`${timetableInfo.time} · ${scheduledDestination(timetableInfo)}`} onClose={() => setTimetableInfo(undefined)}>
          <p className="timetable-info">
            <span className="train__timetable">{timetableInfo.tomorrow ? t.tomorrow : t.timetabled}</span>
            {timetableInfo.category === 'nir' ? t.nirTimetableNote : t.timetableWindow(LIVE_WINDOW_MINS)}
          </p>
        </Sheet>
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

/** One place on a track: a live train, or a timetabled one, with when it leaves (minutes after today's midnight). */
/** Other services with trains on a track that has none of ours, and how soon the first one is due. */
interface OtherServices {
  services: ServiceId[];
  /** Where they go, soonest first: DARTs run north from Kilbarrack, but only to Howth and Malahide. */
  destinations: string[];
  nextInMins: number;
}

/** Which live train category each service's trains are (Cork's are commuter trains too, but share no station). */
const SERVICE_CATEGORY: Record<ServiceId, TrainCategory | undefined> = {
  dart: 'dart',
  enterprise: 'enterprise',
  commuter: 'commuter',
  intercity: 'intercity',
  cork: 'commuter',
  nir: undefined,
};

type TrackTrain = { live: Departure; timetabled?: undefined; at: number } | { live?: undefined; timetabled: TimetabledDeparture; at: number };

function Trains({
  direction,
  items,
  nir,
  compass,
  liveStation,
  moreCount,
  onMore,
  ends,
  goingToName,
  hidden,
  hasData,
  onOpen,
  onTimetabled,
  serviceId,
  others,
  lastTodayCode,
}: {
  direction: Direction;
  /** Live and timetabled trains, in time order, as many as fit. */
  items: TrackTrain[];
  /** An NI Railways page: timetabled trains are the norm, not a stand-in for live ones. */
  nir: boolean;
  /** Name the track by compass direction ("No northbound trains"), or else by where its trains go. */
  compass: boolean;
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
  /** Tap a timetabled train for a note on why it isn't live yet. */
  onTimetabled: (train: TimetabledDeparture) => void;
  serviceId: ServiceId;
  /** Other services' trains this way, when this track has none of ours. */
  others?: OtherServices;
  /** The last train today on this track (see trainsFor), tagged "Last today". */
  lastTodayCode?: string;
}) {
  const { t, destinationName, describe, nameOf, list } = useI18n();
  const side = direction === 'Northbound' ? 'north' : 'south';
  if (!hasData || hidden) return null;

  // A note by the platform. Live services: nothing live this way in the live window. NI Railways: no more trains
  // today (tomorrow's first ones follow), or none in the timetable at all.
  const anyLive = items.some((x) => x.live);
  const noneToday = items.length > 0 && items.every((x) => x.timetabled?.tomorrow);
  let message: string | undefined;
  if (!ends.length && !items.length) message = t.terminateHere;
  else if (nir) message = !items.length ? t.noTimetabledTrains : noneToday ? t.noMoreToday : undefined;
  // Irish Rail after the last train: tomorrow's first is shown, so say there are no more today.
  else if (noneToday && !goingToName) message = t.noMoreToday;
  else if (!anyLive) {
    // Named by where this track's trains go: its ends, or (past the end of our line, e.g. Maynooth to Longford)
    // the timetabled trains' destinations.
    const places = ends.length ? ends : [...new Set(items.flatMap((x) => (x.timetabled?.destinationCode ? [x.timetabled.destinationCode] : [])))];
    const service = t.serviceNames[serviceId];
    message = goingToName
      ? t.noTrainsTo(goingToName)
      : others
        ? // Not "no trains" when another service's trains run this way: name ours, and say which do.
          // The track's own label already says where it goes, so the note just names the services.
          `${t.noServiceTrains(service)} ${t.otherServicesRun(list(others.services.map((id) => t.serviceNames[id])), list(others.destinations.slice(0, 3).map(nameOf)), others.nextInMins)}`
        : compass
          ? t.noTrains(t.direction[direction])
          : places.length
            ? t.noTrainsTowards(list(places.map(nameOf)))
            : t.noTrainsAnyDirection;
  }
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
            <li
              key={d.trainCode}
              data-train={d.trainCode}
              // Untracked: drawn hollow like a timetabled train, since its time is only the timetable's.
              className={`train train--${side}${i === 0 ? ' train--next' : ''}${d.untracked ? ' train--scheduled train--untracked' : ''}`}
              aria-label={`${describe(d)}${d.trainCode === lastTodayCode ? `, ${t.lastTrainToday}` : ''}`}
            >
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
                  {d.trainCode === lastTodayCode && <span className="train__last">{t.lastToday}</span>}
                  {d.untracked ? (
                    <>
                      <span className="train__timetable">{t.notTracked}</span>
                      <span className="train__planned">{d.scheduledDepart}</span>
                    </>
                  ) : d.lateMins > 0 ? (
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
            <Fragment key={`${s!.trainCode}-${s!.minutes}`}>
              {/* A break in the track before tomorrow's first train, after today's. */}
              {s!.tomorrow && i > 0 && !shown[i - 1]!.timetabled?.tomorrow && (
                <li className={`trains__break trains__break--${side}`} aria-hidden>
                  <span className="trains__gap" />
                  <span className="trains__break-label">{t.tomorrow}</span>
                </li>
              )}
              <TimetabledTrain
                d={s!}
                side={side}
                next={i === 0 && !liveStation}
                hollow={liveStation}
                lastToday={s!.trainCode === lastTodayCode && !s!.tomorrow}
                onOpen={() => onTimetabled(s!)}
              />
            </Fragment>
          ),
        )}
      </ol>
      {side === 'south' && note}
      {side === 'north' && more}
    </>
  );
}

/**
 * A timetabled train: no live position or journey yet, so tapping it explains why (the live window, or no live
 * NI Railways times). NI Railways trains (never live) show their clock time, since a countdown would look live;
 * Irish Rail's, beyond the live window, a countdown. Hollow among live trains, solid at stations with none.
 */
function TimetabledTrain({
  d,
  side,
  next,
  hollow,
  lastToday,
  onOpen,
}: {
  d: TimetabledDeparture;
  side: 'north' | 'south';
  next: boolean;
  hollow: boolean;
  /** Today's last train on this track: "Last today" in place of the timetable tag (the hollow train says that). */
  lastToday: boolean;
  onOpen: () => void;
}) {
  const { t, scheduledDestination } = useI18n();
  const now = useNow();
  // Clock times for NI Railways (a countdown would look live) and for tomorrow's trains ("669 min" reads oddly).
  const clock = d.category === 'nir' || !!d.tomorrow;
  const destination = scheduledDestination(d);
  return (
    <li
      className={`train train--${side}${next ? ' train--next' : ''}${hollow ? ' train--scheduled' : ''}`}
      aria-label={`${t.describeScheduled(destination, d.time)}${d.tomorrow ? `, ${t.tomorrow}` : ''}${lastToday ? `, ${t.lastTrainToday}` : ''}`}
    >
      <button className="train__open" aria-label={t.whyTimetabled(destination)} onClick={onOpen} />
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
          {lastToday ? (
            <span className="train__last">{t.lastToday}</span>
          ) : (
            <span className="train__timetable">{d.tomorrow ? t.tomorrow : t.timetabled}</span>
          )}
          {!clock && <span className="train__planned">{d.time}</span>}
        </span>
      </div>
    </li>
  );
}

/** Three lines: "show as a list". */
export function ListIcon() {
  return (
    <svg className="switch-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** Two tracks with arrows: "show on the tracks". */
export function TracksIcon() {
  return (
    <svg className="switch-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 21V4M5 7l3-3 3 3M16 3v17M13 17l3 3 3-3" />
    </svg>
  );
}
