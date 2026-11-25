import { type Direction, findStationByCode, stationsAhead } from '@dart-times/core';

interface Props {
  from: string;
  directions: Direction[];
  selected?: string;
  onSelect: (code: string) => void;
}

/** Stations you can reach from `from`, grouped by direction, nearest first. */
export function DestinationList({ from, directions, selected, onSelect }: Props) {
  return (
    <>
      {directions.map((direction) => {
        const ahead = stationsAhead(from, direction);
        if (!ahead.length) return null;
        return (
          <section key={direction} className="destinations">
            <h3 className={`destinations__heading destinations__heading--${direction === 'Northbound' ? 'north' : 'south'}`}>
              {direction === 'Northbound' ? '↑' : '↓'} {direction}
            </h3>
            <ul className="destinations__list">
              {ahead.map((code) => (
                <li key={code}>
                  <button
                    className={`destinations__item${code === selected ? ' destinations__item--selected' : ''}`}
                    aria-pressed={code === selected}
                    onClick={() => onSelect(code)}
                  >
                    {findStationByCode(code)?.shortName ?? code}
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
