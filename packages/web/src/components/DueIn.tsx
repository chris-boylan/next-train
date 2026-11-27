import { Fragment } from 'react';
import { dueParts } from '../lib/due';
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

/** The same countdown as plain text, for inline use: "12 min", or "1h 26 min". */
export function useDueText(): (mins: number) => string {
  const { t } = useI18n();
  const [style] = useCountdownStyle();
  return (mins) =>
    dueParts(mins, style)
      .map(({ value, unit }) => (unit === 'h' ? `${value}${t.hour}` : `${value} ${t.min}`))
      .join(' ');
}
