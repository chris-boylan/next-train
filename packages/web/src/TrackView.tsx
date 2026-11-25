import {
  adjacentStations,
  type Departure,
  delaySeverity,
  describeDeparture,
  type Direction,
  findStationByCode,
  joinList,
  type Station,
  terminiFrom,
} from '@dart-times/core';
import { formatTime, useNow } from './clock';
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

const shortNames = (codes: string[]) => codes.map((c) => findStationByCode(c)?.shortName ?? c);

/**
 * The station on a double track: northbound (green) on the left, coming up from the bottom;
 * southbound (orange) on the right, coming down from the top. Nearest trains sit closest to the station.
 */
export function TrackView({ station, isFavourite, onToggleFavourite, onChangeStation, onSelectStation }: Props) {
  const { data, error } = useDepartures(station.code);
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);
  const stale = !!fetchedAt && now.getTime() - fetchedAt.getTime() > STALE_AFTER_MS;
  const byDirection = (direction: Direction) =>
    data?.departures.filter((d) => d.direction === direction).slice(0, TRAINS_PER_DIRECTION) ?? [];

  const north = terminiFrom(station.code, 'Northbound');
  const south = terminiFrom(station.code, 'Southbound');
  const neighbours = adjacentStations(station.code);

  return (
    <div className="track-view">
      <header className="track-view__bar">
        <button className="chip" onClick={onChangeStation}>
          ‹ Stations
        </button>
        <div className="clock">
          <p className="clock__now">
            <span className="clock__label">Now</span> <time>{formatTime(now)}</time>
          </p>
          <p className={`clock__updated${error || stale ? ' clock__updated--stale' : ''}`} role="status">
            {fetchedAt ? (
              <>
                Updated <time>{formatTime(fetchedAt, true)}</time>
                {error && ' · retrying'}
              </>
            ) : (
              (error ?? 'Loading…')
            )}
          </p>
        </div>
        <button
          className={`star${isFavourite ? ' star--on' : ''}`}
          onClick={onToggleFavourite}
          aria-pressed={isFavourite}
          aria-label={isFavourite ? `Remove ${station.shortName} from favourites` : `Add ${station.shortName} to favourites`}
        >
          {isFavourite ? '★' : '☆'}
        </button>
      </header>

      <div className="tracks">
        <Lane direction="Northbound" endsHere={!north.length} />
        <Lane direction="Southbound" endsHere={!south.length} />

        {/* Top half: southbound trains on their way in, nearest at the bottom. Green arrow continues up to its termini. */}
        <section className="half half--top" aria-label={`Southbound, towards ${joinList(shortNames(south))}`}>
          <p className="terminus terminus--north" aria-hidden>
            <Termini codes={north} />
          </p>
          <Trains direction="Southbound" trains={byDirection('Southbound')} ends={south} hasData={!!data} />
        </section>

        <div className="platform">
          <Neighbours codes={neighbours.north} direction="north" onSelect={onSelectStation} />
          <h1 className="platform__name">{station.shortName}</h1>
          <Neighbours codes={neighbours.south} direction="south" onSelect={onSelectStation} />
        </div>

        {/* Bottom half: northbound trains on their way in, nearest at the top. Orange arrow continues down to its termini. */}
        <section className="half half--bottom" aria-label={`Northbound, towards ${joinList(shortNames(north))}`}>
          <Trains direction="Northbound" trains={byDirection('Northbound')} ends={north} hasData={!!data} />
          <p className="terminus terminus--south" aria-hidden>
            <Termini codes={south} />
          </p>
        </section>
      </div>
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
  if (!codes.length) return null;
  return (
    <nav className={`neighbours neighbours--${direction}`} aria-label={`Next station ${direction}`}>
      {codes.map((code) => (
        <button key={code} className="neighbour" onClick={() => onSelect(code)}>
          {direction === 'north' ? '↑' : '↓'} {findStationByCode(code)?.shortName ?? code}
        </button>
      ))}
    </nav>
  );
}

function Termini({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <>
      <span className="terminus__to">to</span>
      {shortNames(codes).map((name) => (
        <span key={name}>{name}</span>
      ))}
    </>
  );
}

/** A full-height arrow; at a terminus the track stops at the platform instead. */
function Lane({ direction, endsHere }: { direction: Direction; endsHere: boolean }) {
  const side = direction === 'Northbound' ? 'north' : 'south';
  return (
    <div className={`lane lane--${side}${endsHere ? ' lane--ends' : ''}`} aria-hidden>
      <div className="lane__shaft" />
      {!endsHere && <div className="lane__head" />}
    </div>
  );
}

function Trains({
  direction,
  trains,
  ends,
  hasData,
}: {
  direction: Direction;
  trains: Departure[];
  ends: string[];
  /** False while loading or after a failed first load; the status bar says which. */
  hasData: boolean;
}) {
  const side = direction === 'Northbound' ? 'north' : 'south';
  if (!hasData) return null;
  if (!trains.length) {
    return (
      <p className={`trains-empty trains-empty--${side}`}>
        {ends.length ? `No ${direction.toLowerCase()} DARTs in the next 90 minutes` : 'Trains terminate here'}
      </p>
    );
  }
  return (
    <ol className={`trains trains--${side}`}>
      {trains.map((d, i) => (
        <li key={d.trainCode} className={`train train--${side}${i === 0 ? ' train--next' : ''}`} aria-label={describeDeparture(d)}>
          <TrainGlyph />
          <div className="train__info">
            <span className="train__due">{d.dueInMins <= 0 ? 'Due' : `${d.dueInMins} min`}</span>
            <span className="train__dest">{d.destination}</span>
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
  );
}

/** A DART seen head-on. */
function TrainGlyph() {
  return (
    <svg className="train__glyph" viewBox="0 0 40 52" aria-hidden>
      <rect x="2" y="2" width="36" height="48" rx="10" className="glyph-body" />
      <rect x="8" y="9" width="24" height="15" rx="3" className="glyph-window" />
      <circle cx="11" cy="38" r="3" className="glyph-light" />
      <circle cx="29" cy="38" r="3" className="glyph-light" />
    </svg>
  );
}
