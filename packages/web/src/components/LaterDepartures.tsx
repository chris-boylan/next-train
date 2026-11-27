import {
  LIVE_WINDOW_MINS,
  type ScheduledDeparture,
  scheduledBeyondLive,
  type TrainCategory,
} from "@dart-times/core";
import { Caps, useI18n } from "../lib/i18n";
import type { TimetabledDeparture } from "../lib/useScheduled";

interface Props {
  /** Today's timetabled trains, and tomorrow's (flagged `tomorrow`) when the page loaded them. */
  departures: TimetabledDeparture[];
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
  /** `null` for no note, when the page already explains (NI Railways stations' board note). */
  note?: string | null;
}

/** How many of tomorrow's first trains to list: one per destination, so a busy station's board stays short. */
const TOMORROW_LIMIT = 6;

/** "Later · timetable": scheduled trains beyond the live window, with no live information yet. */
export function LaterDepartures({
  departures,
  nowMinutes,
  liveCodes,
  include,
  showCategory = false,
  limit = 10,
  title,
  note,
}: Props) {
  const { t, scheduledDestination } = useI18n();
  const today = departures.filter((d) => !d.tomorrow);
  const later = scheduledBeyondLive(today, {
    nowMinutes,
    liveCodes,
    include,
    limit,
  });
  // Tomorrow: the first train to each destination, after today's, in their own section.
  const firstTomorrow = departures
    .filter((d) => d.tomorrow && include(d))
    .filter(
      (d, i, all) =>
        all.findIndex(
          (x) =>
            (x.destinationCode ?? x.destination) ===
            (d.destinationCode ?? d.destination),
        ) === i,
    )
    .slice(0, TOMORROW_LIMIT);
  if (!later.length && !firstTomorrow.length) return null;
  return (
    <>
      {later.length > 0 && todaySection()}
      {firstTomorrow.length > 0 && (
        <section
          className="later later--tomorrow"
          aria-labelledby="tomorrow-heading"
        >
          <h2
            id="tomorrow-heading"
            className="destinations__heading later__heading"
          >
            {t.tomorrowFirst}
          </h2>
          <ol className="departure-list">{firstTomorrow.map(row)}</ol>
        </section>
      )}
    </>
  );

  function row(d: ScheduledDeparture) {
    return (
      <li
        key={`${d.trainCode}-${d.minutes}`}
        className="departure-row later__row"
      >
        <span className="later__time">{d.time}</span>
        <span className="board__what">
          <span className="departure-row__dest">
            <Caps text={scheduledDestination(d)} />
          </span>
          {showCategory && <Badge category={d.category} />}
        </span>
      </li>
    );
  }

  function todaySection() {
    return (
      <section className="later" aria-labelledby="later-heading">
        <h2 id="later-heading" className="destinations__heading later__heading">
          {title ?? t.later}
        </h2>
        {note !== null && (
          <p className="later__note">{note ?? t.laterNote(LIVE_WINDOW_MINS)}</p>
        )}
        <ol className="departure-list">{later.map(row)}</ol>
      </section>
    );
  }
}

function Badge({ category }: { category: TrainCategory }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge--${category}`}>{t.categories[category]}</span>
  );
}
