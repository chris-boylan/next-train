import { useState } from 'react';
import {
  type Departure,
  delaySeverity,
  departuresGoingTo,
  describeDeparture,
  type Direction,
  findStationByCode,
  type Station,
  terminiFrom,
} from '@dart-times/core';
import { DestinationList } from './DestinationList';
import { HiddenNote } from './HiddenNote';
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
      {label}
    </button>
  );

  return (
    <Sheet title={`${station.shortName} · ${direction}`} onClose={onClose}>
      <p className="sheet__label">Going to</p>
      <div className="filter-chips">
        {chip('All', undefined, !goingTo)}
        {quickPicks.map((code) => chip(findStationByCode(code)?.shortName ?? code, code, goingTo === code))}
        <button
          className={`filter-chip${otherSelected || choosingOther ? ' filter-chip--on' : ''}`}
          aria-expanded={choosingOther}
          onClick={() => setChoosingOther(!choosingOther)}
        >
          {otherSelected ? findStationByCode(goingTo)?.shortName : 'Other station…'}
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
              <li key={d.trainCode} className="departure-row" aria-label={describeDeparture(d)}>
                <span className="departure-row__due">
                  {d.dueInMins <= 0 ? 'Due' : d.dueInMins}
                  {d.dueInMins > 0 && <span className="train__unit">min</span>}
                </span>
                <span className="departure-row__dest">{d.destination}</span>
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
          {!shown.length && <p className="sheet__empty">No matching DARTs in the next 90 minutes.</p>}
          {goingTo && <HiddenNote all={departures} shown={shown} />}
        </>
      )}
    </Sheet>
  );
}
