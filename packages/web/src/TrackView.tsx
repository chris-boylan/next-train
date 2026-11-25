import { useState } from 'react';
import {
  adjacentStations,
  type Departure,
  delaySeverity,
  departuresGoingTo,
  type Direction,
  directionBetween,
  type Station,
  terminiFrom,
} from '@dart-times/core';
import { formatTime, useNow } from './clock';
import { DeparturesSheet } from './DeparturesSheet';
import { DestinationList } from './DestinationList';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';
import { getGoingTo, setGoingTo } from './prefs';
import { Sheet } from './Sheet';
import { useDepartures } from './useDepartures';

const TRAINS_PER_DIRECTION = 3;
/** Data refreshes every 30s; older than this and something's wrong (e.g. no signal). */
const STALE_AFTER_MS = 90_000;

interface Props {
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
export function TrackView({ station, isFavourite, onToggleFavourite, onChangeStation, onSelectStation }: Props) {
  const { t, stationName, nameOf, list } = useI18n();
  const { data, error } = useDepartures(station.code);
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);
  const stale = !!fetchedAt && now.getTime() - fetchedAt.getTime() > STALE_AFTER_MS;

  // "Going to": remembered per station. It sets the direction, dims the other track and hides trains that won't get you there.
  const [goingTo, setGoingToState] = useState(() => {
    const saved = getGoingTo(station.code);
    return saved && directionBetween(station.code, saved) ? saved : undefined;
  });
  const chooseGoingTo = (code: string | undefined) => {
    setGoingToState(code);
    setGoingTo(station.code, code);
  };
  const goingDirection = goingTo ? directionBetween(station.code, goingTo) : undefined;
  const [sheet, setSheet] = useState<{ kind: 'more'; direction: Direction } | { kind: 'goingTo' }>();

  const allIn = (direction: Direction) => data?.departures.filter((d) => d.direction === direction) ?? [];
  const shownIn = (direction: Direction) =>
    goingTo && goingDirection === direction ? departuresGoingTo(allIn(direction), station.code, goingTo) : allIn(direction);
  const dimmed = (direction: Direction) => !!goingDirection && goingDirection !== direction;
  const goingToName = goingTo && nameOf(goingTo);
  const name = stationName(station);

  const trainsFor = (direction: Direction, ends: string[]) => {
    const shown = shownIn(direction);
    return (
      <Trains
        direction={direction}
        trains={dimmed(direction) ? [] : shown.slice(0, TRAINS_PER_DIRECTION)}
        moreCount={dimmed(direction) ? 0 : Math.max(0, shown.length - TRAINS_PER_DIRECTION)}
        onMore={() => setSheet({ kind: 'more', direction })}
        ends={ends}
        goingToName={goingDirection === direction ? goingToName : undefined}
        hidden={dimmed(direction)}
        hasData={!!data}
      />
    );
  };

  const north = terminiFrom(station.code, 'Northbound');
  const south = terminiFrom(station.code, 'Southbound');
  const neighbours = adjacentStations(station.code);

  return (
    <div className="track-view">
      <header className="track-view__bar">
        <button className="chip" onClick={onChangeStation}>
          ‹ {t.stations}
        </button>
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
              (error ?? t.loading)
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

      <div className="tracks">
        <Lane direction="Northbound" endsHere={!north.length} dimmed={dimmed('Northbound')} />
        <Lane direction="Southbound" endsHere={!south.length} dimmed={dimmed('Southbound')} />

        {/* Top half: southbound trains on their way in, nearest at the bottom. Green arrow continues up to its termini. */}
        <section className="half half--top" aria-label={t.towards(t.direction.Southbound, list(south.map(nameOf)))}>
          <p className={`terminus terminus--north${dimmed('Northbound') ? ' terminus--dimmed' : ''}`} aria-hidden>
            <Termini codes={north} />
          </p>
          {trainsFor('Southbound', south)}
        </section>

        <div className="platform">
          <Neighbours codes={neighbours.north} direction="north" onSelect={onSelectStation} />
          {/* Some Irish names are long; step the size down so they fit on one line on a phone. */}
          <h1 className={`platform__name${name.length > 20 ? ' platform__name--longer' : name.length > 13 ? ' platform__name--long' : ''}`}>
            <Caps text={name} />
          </h1>
          <Neighbours codes={neighbours.south} direction="south" onSelect={onSelectStation} />
          {goingTo ? (
            <div className="going-to going-to--set">
              <button className="going-to__name" onClick={() => setSheet({ kind: 'goingTo' })}>
                {goingDirection === 'Northbound' ? '↑' : '↓'} <Caps text={t.goingTo(goingToName!)} />
              </button>
              <button className="going-to__clear" onClick={() => chooseGoingTo(undefined)} aria-label={t.showAll}>
                ✕
              </button>
            </div>
          ) : (
            <button className="going-to" onClick={() => setSheet({ kind: 'goingTo' })}>
              {t.goingToPrompt}
            </button>
          )}
        </div>

        {/* Bottom half: northbound trains on their way in, nearest at the top. Orange arrow continues down to its termini. */}
        <section className="half half--bottom" aria-label={t.towards(t.direction.Northbound, list(north.map(nameOf)))}>
          {trainsFor('Northbound', north)}
          <p className={`terminus terminus--south${dimmed('Southbound') ? ' terminus--dimmed' : ''}`} aria-hidden>
            <Termini codes={south} />
          </p>
        </section>
      </div>

      {sheet?.kind === 'more' && (
        <DeparturesSheet
          station={station}
          direction={sheet.direction}
          departures={allIn(sheet.direction)}
          goingTo={goingDirection === sheet.direction ? goingTo : undefined}
          onGoingTo={chooseGoingTo}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet?.kind === 'goingTo' && (
        <Sheet title={t.goingToTitle(name)} onClose={() => setSheet(undefined)}>
          <DestinationList
            from={station.code}
            directions={['Northbound', 'Southbound']}
            selected={goingTo}
            onSelect={(code) => {
              chooseGoingTo(code);
              setSheet(undefined);
            }}
          />
        </Sheet>
      )}
    </div>
  );
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
  if (!codes.length) return null;
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

/** A full-height arrow; at a terminus the track stops at the platform instead. */
function Lane({ direction, endsHere, dimmed }: { direction: Direction; endsHere: boolean; dimmed: boolean }) {
  const side = direction === 'Northbound' ? 'north' : 'south';
  return (
    <div className={`lane lane--${side}${endsHere ? ' lane--ends' : ''}${dimmed ? ' lane--dimmed' : ''}`} aria-hidden>
      <div className="lane__shaft" />
      {!endsHere && <div className="lane__head" />}
    </div>
  );
}

function Trains({
  direction,
  trains,
  moreCount,
  onMore,
  ends,
  goingToName,
  hidden,
  hasData,
}: {
  direction: Direction;
  trains: Departure[];
  /** Departures beyond the ones shown, opened in the full list. */
  moreCount: number;
  onMore: () => void;
  ends: string[];
  goingToName?: string;
  /** The other direction to where you're going: its track is dimmed and shows no trains. */
  hidden: boolean;
  /** False while loading or after a failed first load; the status bar says which. */
  hasData: boolean;
}) {
  const { t, destinationName, describe } = useI18n();
  const side = direction === 'Northbound' ? 'north' : 'south';
  if (!hasData || hidden) return null;
  if (!trains.length) {
    return (
      <p className={`trains-empty trains-empty--${side}`}>
        {!ends.length ? t.terminateHere : goingToName ? t.noDartsTo(goingToName) : t.noDarts(t.direction[direction])}
      </p>
    );
  }
  const more = moreCount > 0 && (
    <button className={`more more--${side}`} onClick={onMore}>
      {t.more(moreCount)}
    </button>
  );
  // Southbound lists run bottom-up (nearest by the platform), so "more" goes at the far end: the top.
  return (
    <>
      {side === 'south' && more}
      <ol className={`trains trains--${side}`}>
        {trains.map((d, i) => (
          <li key={d.trainCode} className={`train train--${side}${i === 0 ? ' train--next' : ''}`} aria-label={describe(d)}>
            <TrainGlyph />
            <div className="train__info">
              <span className={`train__due${d.dueInMins <= 0 ? ' train__due--now' : ''}`}>
                {d.dueInMins <= 0 ? (
                  t.due
                ) : (
                  <>
                    {d.dueInMins}
                    <span className="train__unit">{t.min}</span>
                  </>
                )}
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
        ))}
      </ol>
      {side === 'north' && more}
    </>
  );
}

/** A DART seen head-on, drawn flat and square. */
function TrainGlyph() {
  return (
    <svg className="train__glyph" viewBox="0 0 40 52" aria-hidden>
      <rect x="2" y="2" width="36" height="48" rx="3" className="glyph-body" />
      <rect x="7" y="9" width="26" height="14" className="glyph-window" />
      <rect x="8" y="36" width="6" height="5" className="glyph-light" />
      <rect x="26" y="36" width="6" height="5" className="glyph-light" />
    </svg>
  );
}
