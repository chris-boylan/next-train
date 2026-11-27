import { describe, expect, it } from 'vitest';
import { dueParts } from '../src/lib/due';

describe('dueParts', () => {
  it('always uses minutes in minutes style', () => {
    expect(dueParts(5, 'minutes')).toEqual([{ value: 5, unit: 'min' }]);
    expect(dueParts(86, 'minutes')).toEqual([{ value: 86, unit: 'min' }]);
  });

  it('keeps minutes under an hour in hours style', () => {
    expect(dueParts(59, 'hours')).toEqual([{ value: 59, unit: 'min' }]);
  });

  it('splits an hour or more into hours and minutes', () => {
    expect(dueParts(86, 'hours')).toEqual([
      { value: 1, unit: 'h' },
      { value: 26, unit: 'min' },
    ]);
    expect(dueParts(150, 'hours')).toEqual([
      { value: 2, unit: 'h' },
      { value: 30, unit: 'min' },
    ]);
  });

  it('drops a zero remainder on the hour', () => {
    expect(dueParts(60, 'hours')).toEqual([{ value: 1, unit: 'h' }]);
    expect(dueParts(120, 'hours')).toEqual([{ value: 2, unit: 'h' }]);
  });
});
