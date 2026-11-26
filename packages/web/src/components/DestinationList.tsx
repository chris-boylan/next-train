import { type Direction, type Line, stationsAhead } from '@dart-times/core';
import { useI18n } from '../lib/i18n';

interface Props {
  from: string;
  line: Line;
  directions: Direction[];
  selected?: string;
  onSelect: (code: string) => void;
}

/** Stations you can reach from `from`, grouped by direction, nearest first. */
export function DestinationList({ from, line, directions, selected, onSelect }: Props) {
  const { t, nameOf } = useI18n();
  return (
    <>
      {directions.map((direction) => {
        const ahead = stationsAhead(from, direction, line);
        if (!ahead.length) return null;
        return (
          <section key={direction} className="destinations">
            <h3 className={`destinations__heading destinations__heading--${direction === 'Northbound' ? 'north' : 'south'}`}>
              {direction === 'Northbound' ? '↑' : '↓'} {t.direction[direction]}
            </h3>
            <ul className="destinations__list">
              {ahead.map((code) => (
                <li key={code}>
                  <button
                    className={`destinations__item${code === selected ? ' destinations__item--selected' : ''}`}
                    aria-pressed={code === selected}
                    onClick={() => onSelect(code)}
                  >
                    {nameOf(code)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
