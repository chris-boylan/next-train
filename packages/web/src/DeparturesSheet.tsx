import { useState } from 'react';
import {
  type Departure,
  delaySeverity,
  departuresGoingTo,
  type Direction,
  type Station,
  terminiFrom,
} from '@dart-times/core';
import { DestinationList } from './DestinationList';
import { HiddenNote } from './HiddenNote';
import { Caps, useI18n } from './i18n';
import { Sheet } from './Sheet';

interface Props {
  station: Station;
  direction: Direction;
  /** All departures in this direction for the next 90 minutes. */
  departures: Departure[];
  goingTo?: string;
  onGoingTo: (code: string | undefined) => void;
  onClose: () => void;
}

/** Every departure in one direction, with quick "going to" picks. */
export function DeparturesSheet({ station, direction, departures, goingTo, onGoingTo, onClose }: Props) {
  const { t, stationName, nameOf, destinationName, describe } = useI18n();
  const [choosingOther, setChoosingOther] = useState(false);
  const quickPicks = terminiFrom(station.code, direction);
  const shown = goingTo ? departuresGoingTo(departures, station.code, goingTo) : departures;
  const otherSelected = !!goingTo && !quickPicks.includes(goingTo);

  const chip = (label: string, code: string | undefined, pressed: boolean) => (
    <button
      key={label}
      className={`filter-chip${pressed ? ' filter-chip--on' : ''}`}
      aria-pressed={pressed}
      onClick={() => {
        setChoosingOther(false);
        onGoingTo(code);
      }}
    >
      <Caps text={label} />
    </button>
  );

  return (
    <Sheet title={`${stationName(station)} · ${t.direction[direction]}`} onClose={onClose}>
      <p className="sheet__label">{t.goingToLabel}</p>
      <div className="filter-chips">
        {chip(t.all, undefined, !goingTo)}
        {quickPicks.map((code) => chip(nameOf(code), code, goingTo === code))}
        <button
          className={`filter-chip${otherSelected || choosingOther ? ' filter-chip--on' : ''}`}
          aria-expanded={choosingOther}
          onClick={() => setChoosingOther(!choosingOther)}
        >
          <Caps text={otherSelected ? nameOf(goingTo) : t.otherStation} />
        </button>
      </div>

      {choosingOther ? (
        <DestinationList
          from={station.code}
          directions={[direction]}
          selected={goingTo}
          onSelect={(code) => {
            setChoosingOther(false);
            onGoingTo(code);
          }}
        />
      ) : (
        <>
          <ol className="departure-list">
            {shown.map((d) => (
              <li key={d.trainCode} className="departure-row" aria-label={describe(d)}>
                <span className={`departure-row__due${d.dueInMins <= 0 ? ' departure-row__due--now' : ''}`}>
                  {d.dueInMins <= 0 ? t.due : d.dueInMins}
                  {d.dueInMins > 0 && <span className="train__unit">{t.min}</span>}
                </span>
                <span className="departure-row__dest">
                  <Caps text={destinationName(d)} />
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
          {!shown.length && <p className="sheet__empty">{t.noMatching}</p>}
          {goingTo && <HiddenNote all={departures} shown={shown} />}
        </>
      )}
    </Sheet>
  );
}
