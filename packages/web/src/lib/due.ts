/** How a countdown is written: always in minutes ("86 min"), or in hours and minutes once it's an hour or more ("1h 26min"). */
export type CountdownStyle = 'minutes' | 'hours';

export interface DuePart {
  value: number;
  unit: 'h' | 'min';
}

/**
 * The number/unit pairs for a countdown of `mins` minutes (> 0). In "hours" style, an hour or more becomes hours
 * and minutes, dropping a zero remainder: 86 → 1h 26min, 120 → 2h, 150 → 2h 30min. Under an hour is always minutes.
 */
export function dueParts(mins: number, style: CountdownStyle): DuePart[] {
  if (style === 'minutes' || mins < 60) return [{ value: mins, unit: 'min' }];
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0
    ? [{ value: hours, unit: 'h' }]
    : [
        { value: hours, unit: 'h' },
        { value: rest, unit: 'min' },
      ];
}
