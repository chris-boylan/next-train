import { LIVE_WINDOW_MINS, type ScheduledDeparture, scheduledBeyondLive, type TrainCategory } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';

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
  /** Instead of "Later · timetable" and its note, e.g. at NI Railways stations, which have no live times. */
  title?: string;
  note?: string;
}

/** "Later · timetable": scheduled trains beyond the live window, with no live information yet. */
export function LaterDepartures({ departures, nowMinutes, liveCodes, include, showCategory = false, limit = 10, title, note }: Props) {
  const { t, scheduledDestination } = useI18n();
  const later = scheduledBeyondLive(departures, { nowMinutes, liveCodes, include, limit });
  if (!later.length) return null;
  return (
    <section className="later" aria-labelledby="later-heading">
      <h2 id="later-heading" className="destinations__heading later__heading">
        {title ?? t.later}
      </h2>
      <p className="later__note">{note ?? t.laterNote(LIVE_WINDOW_MINS)}</p>
      <ol className="departure-list">
        {later.map((d) => (
          <li key={`${d.trainCode}-${d.minutes}`} className="departure-row later__row">
            <span className="later__time">{d.time}</span>
            <span className="board__what">
              <span className="departure-row__dest">
                <Caps text={scheduledDestination(d)} />
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
