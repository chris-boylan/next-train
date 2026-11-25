import {
  type Departure,
  type Direction,
  delayText,
  directionLabel,
  dueText,
  isSignificantDelay,
  joinList,
  type Station,
} from '@dart-times/core';

/** How many departures to read out; any more is hard to follow by voice. */
export const SPOKEN_DEPARTURES = 3;

export function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Like the shared `describeDeparture`, but only mentions delays worth hearing about. */
function speakDeparture(d: Departure): string {
  const delay = isSignificantDelay(d) ? `, running ${delayText(d.lateMins)}` : '';
  return `to ${d.destination} ${dueText(d.dueInMins)}${delay}`;
}

export function departuresSpeech(station: Station, departures: Departure[], direction?: Direction): string {
  const which = direction ? ` ${directionLabel(direction)}` : '';
  if (!departures.length) {
    return escapeSsml(`There are no${which} DARTs from ${station.shortName} in the next 90 minutes.`);
  }
  const spoken = departures.slice(0, SPOKEN_DEPARTURES);
  const intro =
    spoken.length === 1
      ? `The next${which} DART from ${station.shortName} is`
      : `The next${which} DARTs from ${station.shortName} are`;
  return escapeSsml(`${intro} ${joinList(spoken.map(speakDeparture))}.`);
}
