import { Fragment } from 'react';
import { type CountdownStyle, dueParts } from '../lib/due';
import { useI18n } from '../lib/i18n';
import { useCountdownStyle } from '../lib/prefs';

/** A countdown in the user's chosen style, with small units: "86 MIN", or "1H 26MIN". `mins` must be above 0. */
export function DueIn({ mins }: { mins: number }) {
  const { t } = useI18n();
  const [style] = useCountdownStyle();
  return (
    <>
      {dueParts(mins, style).map(({ value, unit }) => (
        <Fragment key={unit}>
          {value}
          <span className={`train__unit${unit === 'h' ? ' train__unit--hours' : ''}`}>{unit === 'h' ? t.hour : t.min}</span>
        </Fragment>
      ))}
    </>
  );
}

/** A countdown as plain text in a given style: "86 min", or "1h 26 min". */
function dueText(mins: number, style: CountdownStyle, units: { hour: string; min: string }): string {
  return dueParts(mins, style)
    .map(({ value, unit }) => (unit === 'h' ? `${value}${units.hour}` : `${value} ${units.min}`))
    .join(' ');
}

/** The same countdown as plain text, for inline use: "12 min", or "1h 26 min". */
export function useDueText(): (mins: number) => string {
  const { t } = useI18n();
  const [style] = useCountdownStyle();
  return (mins) => dueText(mins, style, t);
}
