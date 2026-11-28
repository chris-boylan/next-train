import { useEffect, useLayoutEffect, useRef } from 'react';
import { type Departure, type Direction, delaySeverity, type JourneyStop, type TrainNow } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { useDueText } from './DueIn';
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
  /** Where the track and train are on the station page now, to glide back to when closing. */
  returnTo: () => Partial<JourneyOrigin> | undefined;
  closing: boolean;
  /** Today's last train on its track: says so, as its tag on the station page does. */
  lastToday?: boolean;
  onClose: () => void;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// A soft ease-in-out: starts gently, glides, and settles gently. The track and train move together, a moment
// after the station page starts fading; the stops then appear one by one, from the train towards the terminus.
const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
const GLIDE = { duration: 850, delay: 80, easing: EASE, fill: 'backwards' } as const;
/** When the stops start appearing (after the glide has mostly settled), and the gap between each. */
const STOPS_FROM_MS = 700;
const STOP_STEP_MS = 55;
/** Closing is the opening in reverse: stops fade first, then the track and train glide back (mirrored curve). */
const RETURN = { duration: 750, delay: 160, easing: 'cubic-bezier(0.8, 0, 0.55, 1)', fill: 'forwards' } as const;
/** Then the rest of the station page fades in (journey.css reads these as --return-fade-*). */
export const RETURN_FADE_DELAY_MS = RETURN.delay + RETURN.duration;
export const RETURN_FADE_MS = 450;
/** How long closing takes; the track and train stay on top until the page is back, then TrackView removes the view. */
export const JOURNEY_CLOSE_MS = RETURN_FADE_DELAY_MS + RETURN_FADE_MS + 30;

/** The transforms that put the centred track and train back where they are on the station page. */
function placeAt(lane: HTMLElement, glyph: HTMLElement, at: Partial<JourneyOrigin>, side: 'north' | 'south') {
  const to = lane.getBoundingClientRect();
  const g = glyph.getBoundingClientRect();
  return {
    // The station page's track runs from its edge of the screen to the platform, so it scales from that end.
    origin: `50% ${side === 'north' ? 'bottom' : 'top'}`,
    lane:
      at.lane &&
      `translateX(${at.lane.left + at.lane.width / 2 - (to.left + to.width / 2)}px) scaleY(${at.lane.height / to.height})`,
    glyph:
      at.glyph &&
      `translate(${at.glyph.left + at.glyph.width / 2 - (g.left + g.width / 2)}px, ${at.glyph.top + at.glyph.height / 2 - (g.top + g.height / 2)}px) scale(${at.glyph.width / g.width})`,
  };
}

/**
 * A train's look-ahead, drawn over the station page: its track moves to the centre and runs the full height,
 * the train sits at the end it's coming from, and its stops to the terminus line the track with expected times.
 * Northbound trains travel up, so the train sits at the bottom with the stops above; southbound, the reverse.
 */
export function JourneyView({ train, direction, stationCode, origin, returnTo, closing, lastToday, onClose }: Props) {
  const { t, nameOf, destinationName } = useI18n();
  const { journey, error } = useJourney(train, stationCode);
  const side = direction === 'Northbound' ? 'north' : 'south';
  const laneRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLButtonElement>(null);
  // Stops appear once the glide has settled, timed from opening (not from when the data arrives), and fixed the
  // first time they render so a refresh never replays them.
  const openedAt = useRef(performance.now());
  const stopsDelay = useRef<number>();

  // The station page's track and train glide to their new places (FLIP: start where they were, animate to here).
  useLayoutEffect(() => {
    const lane = laneRef.current;
    const glyph = glyphRef.current;
    if (!origin || !lane || !glyph || reduceMotion()) return;
    const from = placeAt(lane, glyph, origin, side);
    const animations = [
      lane.animate([{ transform: from.lane, transformOrigin: from.origin }, { transform: 'none', transformOrigin: from.origin }], GLIDE),
      glyph.animate([{ transform: from.glyph }, { transform: 'none' }], GLIDE),
    ];
    // Cancelled if the effect runs again, so the next measurement isn't taken mid-animation.
    return () => animations.forEach((a) => a.cancel());
  }, [origin, side]);

  // Closing: the same glide in reverse, back to where the track and train are now. If the train has left the
  // station page's list meanwhile, it fades instead.
  useLayoutEffect(() => {
    const lane = laneRef.current;
    const glyph = glyphRef.current;
    if (!closing || !lane || !glyph || reduceMotion()) return;
    const to = placeAt(lane, glyph, returnTo() ?? {}, side);
    const animations = [
      to.lane
        ? lane.animate([{ transform: 'none', transformOrigin: to.origin }, { transform: to.lane, transformOrigin: to.origin }], RETURN)
        : lane.animate([{ opacity: 1 }, { opacity: 0 }], RETURN),
      to.glyph
        ? glyph.animate([{ transform: 'none' }, { transform: to.glyph }], RETURN)
        : glyph.animate([{ opacity: 1 }, { opacity: 0 }], RETURN),
    ];
    return () => animations.forEach((a) => a.cancel());
  }, [closing, returnTo, side]);

  useEffect(() => {
    glyphRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const destination = destinationName(train);
  const label = (stop: JourneyStop) => (nameOf(stop.code) !== stop.code ? nameOf(stop.code) : stop.name);
  const stops = journey?.stops ?? [];
  if (stops.length && stopsDelay.current === undefined) {
    stopsDelay.current = Math.max(0, STOPS_FROM_MS - (performance.now() - openedAt.current));
  }
  const firstDelay = stopsDelay.current ?? 0;

  return (
    <section
      className={`journey journey--${side}${train.untracked ? ' journey--untracked' : ''}${closing ? ' journey--closing' : ''}`}
      aria-label={t.journey.stops(destination)}
    >
      <div className="journey__lane" ref={laneRef} aria-hidden />

      <div className="journey__train">
        <button ref={glyphRef} className="journey__glyph" onClick={onClose} aria-label={t.journey.close}>
          <TrainGlyph train={train} />
        </button>
        <p className="journey__now" role="status" style={closing ? undefined : { animationDelay: `${STOPS_FROM_MS + 150}ms` }}>
          {train.untracked ? (
            // No live position to give (where it "is" would only be guessed from the timetable), so say why.
            <>
              <span className="journey__untracked">{t.journey.untrackedTitle}</span>
              <span className="journey__untracked-note">{t.journey.untracked}</span>
            </>
          ) : journey ? (
            <NowLine now={journey.now} name={(code, fallback) => (nameOf(code) !== code ? nameOf(code) : fallback)} />
          ) : error ? (
            t.journey.unavailable
          ) : (
            t.journey.loading
          )}
          {journey?.estimated && <span className="journey__estimated">{t.journey.estimated}</span>}
          {lastToday && (
            <span className="journey__last">
              <span className="train__last">{t.lastToday}</span> {t.lastTodayNote}
            </span>
          )}
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
              // The entrance delay staggers the stops in; closing drops it so they all fade out straight away.
              style={closing ? undefined : { animationDelay: `${firstDelay + Math.min(i, 16) * STOP_STEP_MS}ms` }}
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
  const dueText = useDueText();
  if (stop.cancelled) return <span className="journey__time journey__time--cancelled">{t.journey.cancelled}</span>;
  return (
    <span className="journey__time">
      <span className="journey__when">
        <span className="train__expected">{stop.expected}</span>
        <span className="journey__in"> · {stop.inMins <= 0 ? t.due : dueText(stop.inMins)}</span>
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
