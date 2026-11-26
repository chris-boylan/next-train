import { commuterHeading, type Departure, delaySeverity, isCityStation, type TrainCategory } from '@dart-times/core';
import { formatTime, useNow } from './clock';
import { routeColour } from './commuterRoutes';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';
import { useDepartures } from './useDepartures';

interface Props {
  code: string;
  name: string;
  /** "all": every train at the station, grouped by the API's direction. "commuter": Dublin commuter
   *  trains only, grouped by route and direction (e.g. "Northern · towards Dundalk"). */
  mode: 'all' | 'commuter';
  backLabel: string;
  onBack: () => void;
  favourite?: { on: boolean; toggle: () => void };
}

interface Group {
  key: string;
  label: string;
  colour?: string;
  departures: Departure[];
}

/** A station's departures in the next 90 minutes, as a board grouped by direction (or route and direction). */
export function StationBoard({ code, name, mode, backLabel, onBack, favourite }: Props) {
  const { t, nameOf, destinationName, describe } = useI18n();
  const { data, error } = useDepartures(code, mode);
  const now = useNow();
  const fetchedAt = data && new Date(data.fetchedAt);

  const directionLabel = (direction: string) => {
    if (direction === 'Northbound' || direction === 'Southbound') return t.direction[direction];
    // The API's other directions read "To Galway"; keep the place, translate the "to".
    return direction.replace(/^To\s+/i, `${t.to} `);
  };

  // Commuter groups: route and direction. Outbound reads "towards Maynooth / M3 Parkway"; inbound reads
  // "towards Dublin", except at a city-centre station, where it names where the trains are going.
  const inCity = isCityStation(code);
  const groupOf = (d: Departure): { key: string; label?: string; colour?: string } => {
    if (mode === 'commuter') {
      const heading = commuterHeading(code, d);
      if (heading) {
        const towards = heading.outbound ? heading.route.outer.map(nameOf).join(' / ') : inCity ? undefined : t.dublin;
        return {
          key: `${heading.route.id}:${heading.outbound}`,
          label: towards && `${t.commuterRoutes[heading.route.id]} · ${t.towards2(towards)}`,
          colour: routeColour(heading.route.id),
        };
      }
    }
    return { key: d.direction, label: directionLabel(d.direction) };
  };

  const groups = new Map<string, Group>();
  for (const d of data?.departures ?? []) {
    const { key, label, colour } = groupOf(d);
    const departures = [...(groups.get(key)?.departures ?? []), d];
    // Groups without a fixed label (inbound at a city-centre station) name their destinations.
    const routeId = key.split(':')[0] as keyof typeof t.commuterRoutes;
    const named = label ?? `${t.commuterRoutes[routeId]} · ${t.towards2([...new Set(departures.map(destinationName))].join(' / '))}`;
    groups.set(key, { key, label: named, colour, departures });
  }

  return (
    <div className="board">
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
              (error ?? t.loading)
            )}
          </p>
        </div>
        <div className="track-view__actions">
          <OptionsMenu />
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
        </div>
      </header>

      <div className="board__sign">
        <h1 className="platform__name">
          <Caps text={name} />
        </h1>
      </div>

      <div className="board__body">
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
                    {d.dueInMins <= 0 ? t.due : d.dueInMins}
                    {d.dueInMins > 0 && <span className="train__unit">{t.min}</span>}
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
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: TrainCategory }) {
  const { t } = useI18n();
  return <span className={`badge badge--${category}`}>{t.categories[category]}</span>;
}
