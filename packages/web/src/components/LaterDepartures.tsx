import type { ScheduledDeparture, TrainCategory } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';

/** The live API looks 90 minutes ahead; timetabled trains after that are listed here. */
export const LIVE_WINDOW_MINS = 90;

interface Props {
  departures: ScheduledDeparture[];
  /** Minutes after midnight (Irish time) now, to start after the live window. */
  nowMinutes: number;
  /** Trains already shown live, by train code, so none appears twice. */
  liveCodes: Set<string>;
  /** Which timetabled trains belong here (service, direction, going-to). */
  include: (d: ScheduledDeparture) => boolean;
  showCategory?: boolean;
  limit?: number;
}

/** "Later · timetable": scheduled trains beyond the live window, with no live information yet. */
export function LaterDepartures({ departures, nowMinutes, liveCodes, include, showCategory = false, limit = 10 }: Props) {
  const { t, nameOf } = useI18n();
  const later = departures
    .filter((d) => d.minutes > nowMinutes + LIVE_WINDOW_MINS && !liveCodes.has(d.trainCode) && include(d))
    .slice(0, limit);
  if (!later.length) return null;
  // Our name for the destination when we know the station, else the timetable's without its bracketed part.
  const destination = (d: ScheduledDeparture) => (d.destinationCode ? nameOf(d.destinationCode) : d.destination.replace(/\s*\(.*?\)/g, ''));
  return (
    <section className="later" aria-labelledby="later-heading">
      <h2 id="later-heading" className="destinations__heading later__heading">
        {t.later}
      </h2>
      <p className="later__note">{t.laterNote(LIVE_WINDOW_MINS)}</p>
      <ol className="departure-list">
        {later.map((d) => (
          <li key={`${d.trainCode}-${d.minutes}`} className="departure-row later__row">
            <span className="later__time">{d.time}</span>
            <span className="board__what">
              <span className="departure-row__dest">
                <Caps text={destination(d)} />
              </span>
              {showCategory && <Badge category={d.category} />}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Badge({ category }: { category: TrainCategory }) {
  const { t } = useI18n();
  return <span className={`badge badge--${category}`}>{t.categories[category]}</span>;
}
