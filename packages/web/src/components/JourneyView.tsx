import { useEffect, useLayoutEffect, useRef } from 'react';
import { type Departure, type Direction, delaySeverity, type JourneyStop, type TrainNow } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { useJourney } from '../lib/useJourney';
import { TrainGlyph } from './TrainGlyph';

/** Where the tapped train and its track were on the station page, so they can glide into place. */
export interface JourneyOrigin {
  glyph: DOMRect;
  lane: DOMRect;
}

interface Props {
  train: Departure;
  direction: Direction;
  stationCode: string;
  origin?: JourneyOrigin;
  closing: boolean;
  onClose: () => void;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * A train's look-ahead, drawn over the station page: its track moves to the centre and runs the full height,
 * the train sits at the end it's coming from, and its stops to the terminus line the track with expected times.
 * Northbound trains travel up, so the train sits at the bottom with the stops above; southbound, the reverse.
 */
export function JourneyView({ train, direction, stationCode, origin, closing, onClose }: Props) {
  const { t, nameOf, destinationName } = useI18n();
  const { journey, error } = useJourney(train.trainCode, stationCode);
  const side = direction === 'Northbound' ? 'north' : 'south';
  const laneRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLButtonElement>(null);

  // The station page's track and train glide to their new places (FLIP: start where they were, animate to here).
  useLayoutEffect(() => {
    const lane = laneRef.current;
    const glyph = glyphRef.current;
    if (!origin || !lane || !glyph || reduceMotion()) return;
    const to = lane.getBoundingClientRect();
    const anchor = side === 'north' ? 'bottom' : 'top';
    const dx = origin.lane.left + origin.lane.width / 2 - (to.left + to.width / 2);
    const laneAnimation = lane.animate(
      [
        { transform: `translateX(${dx}px) scaleY(${origin.lane.height / to.height})`, transformOrigin: `50% ${anchor}` },
        { transform: 'none', transformOrigin: `50% ${anchor}` },
      ],
      { duration: 450, easing: EASE },
    );
    const g = glyph.getBoundingClientRect();
    const scale = origin.glyph.width / g.width;
    const glyphAnimation = glyph.animate(
      [
        {
          transform: `translate(${origin.glyph.left + origin.glyph.width / 2 - (g.left + g.width / 2)}px, ${origin.glyph.top + origin.glyph.height / 2 - (g.top + g.height / 2)}px) scale(${scale})`,
        },
        { transform: 'none' },
      ],
      { duration: 450, easing: EASE },
    );
    // Cancelled if the effect runs again, so the next measurement isn't taken mid-animation.
    return () => {
      laneAnimation.cancel();
      glyphAnimation.cancel();
    };
  }, [origin, side]);

  useEffect(() => {
    glyphRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const destination = destinationName(train);
  const label = (stop: JourneyStop) => (nameOf(stop.code) !== stop.code ? nameOf(stop.code) : stop.name);
  const stops = journey?.stops ?? [];

  return (
    <section className={`journey journey--${side}${closing ? ' journey--closing' : ''}`} aria-label={t.journey.stops(destination)}>
      <div className="journey__lane" ref={laneRef} aria-hidden />

      <div className="journey__train">
        <button ref={glyphRef} className="journey__glyph" onClick={onClose} aria-label={t.journey.close}>
          <TrainGlyph />
        </button>
        <p className="journey__now" role="status">
          {journey ? <NowLine now={journey.now} name={(code, fallback) => (nameOf(code) !== code ? nameOf(code) : fallback)} /> : error ? t.journey.unavailable : t.journey.loading}
        </p>
      </div>

      <ol className="journey__stops">
        {stops.map((stop, i) => {
          const here = stop.code === stationCode;
          const end = i === stops.length - 1;
          return (
            <li
              key={stop.code}
              className={`journey__stop${here ? ' journey__stop--here' : ''}${end ? ' journey__stop--end' : ''}${stop.cancelled ? ' journey__stop--cancelled' : ''}`}
              style={{ animationDelay: `${180 + Math.min(i, 14) * 28}ms` }}
            >
              <span className="journey__name">
                <Caps text={label(stop)} />
              </span>
              <span className="journey__dot" aria-hidden />
              <StopTime stop={stop} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NowLine({ now, name }: { now: TrainNow; name: (code: string, fallback: string) => string }) {
  const { t } = useI18n();
  const station = name(now.code, now.name);
  if (now.kind === 'at') return <>{t.journey.at(station)}</>;
  if (now.kind === 'left') return <>{t.journey.left(station, now.minsAgo)}</>;
  return <>{t.journey.notStarted(station, now.departs)}</>;
}

/** "18:42 · 12 min", with the timetabled time struck out and the delay when it's late, as on the station page. */
function StopTime({ stop }: { stop: JourneyStop }) {
  const { t } = useI18n();
  if (stop.cancelled) return <span className="journey__time journey__time--cancelled">{t.journey.cancelled}</span>;
  return (
    <span className="journey__time">
      <span className="journey__when">
        <span className="train__expected">{stop.expected}</span>
        <span className="journey__in"> · {stop.inMins <= 0 ? t.due : `${stop.inMins} ${t.min}`}</span>
      </span>
      {stop.lateMins > 0 && (
        <span className="train__meta">
          <s className="train__scheduled">{stop.scheduled}</s>
          <span className={`late late--${delaySeverity(stop.lateMins)}`}>+{stop.lateMins}</span>
        </span>
      )}
    </span>
  );
}
