import { type Departure, delaySeverity, type TrainCategory } from '@dart-times/core';
import { formatTime, useNow } from './clock';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';
import { useDepartures } from './useDepartures';

interface Props {
  code: string;
  name: string;
  onBack: () => void;
}

/**
 * Every train leaving any Irish Rail station in the next 90 minutes, grouped by the direction the API
 * gives (e.g. "Northbound", "To Galway"), each labelled DART, Enterprise, InterCity or Commuter.
 */
export function StationBoard({ code, name, onBack }: Props) {
  const { t, destinationName, describe } = useI18n();
  const { data, error } = useDepartures(code, 'all');
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);

  const groups = new Map<string, Departure[]>();
  for (const d of data?.departures ?? []) groups.set(d.direction, [...(groups.get(d.direction) ?? []), d]);

  const directionLabel = (direction: string) => {
    if (direction === 'Northbound' || direction === 'Southbound') return t.direction[direction];
    // The API's other directions read "To Galway"; keep the place, translate the "to".
    return direction.replace(/^To\s+/i, `${t.to} `);
  };

  return (
    <div className="board">
      <header className="track-view__bar">
        <button className="chip" onClick={onBack}>
          ‹ {t.map}
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
              (error ?? t.loading)
            )}
          </p>
        </div>
        <OptionsMenu />
      </header>

      <div className="board__sign">
        <h1 className="platform__name">
          <Caps text={name} />
        </h1>
      </div>

      <div className="board__body">
        {data && !data.departures.length && <p className="sheet__empty">{t.noTrainsAnyDirection}</p>}
        {[...groups].map(([direction, departures]) => (
          <section key={direction} className="board__group">
            <h2 className="destinations__heading">
              <Caps text={directionLabel(direction)} />
            </h2>
            <ol className="departure-list">
              {departures.map((d) => (
                <li key={d.trainCode} className="departure-row board__row" aria-label={describe(d)}>
                  <span className={`departure-row__due${d.dueInMins <= 0 ? ' departure-row__due--now' : ''}`}>
                    {d.dueInMins <= 0 ? t.due : d.dueInMins}
                    {d.dueInMins > 0 && <span className="train__unit">{t.min}</span>}
                  </span>
                  <span className="board__what">
                    <span className="departure-row__dest">
                      <Caps text={destinationName(d)} />
                    </span>
                    <CategoryBadge category={d.category} />
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
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: TrainCategory }) {
  const { t } = useI18n();
  return <span className={`badge badge--${category}`}>{t.categories[category]}</span>;
}
