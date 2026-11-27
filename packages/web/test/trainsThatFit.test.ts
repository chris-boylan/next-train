import { describe, expect, it } from 'vitest';
import { trainsThatFit } from '../src/screens/TrackView';

describe('trainsThatFit', () => {
  it('fits three trains on a tall phone, fewer as the half shrinks, never none', () => {
    expect(trainsThatFit(313)).toBe(3); // 375×844, with route chips
    expect(trainsThatFit(211)).toBe(2); // 375×640, with route chips
    expect(trainsThatFit(195)).toBe(2); // 320×568, no chips
    expect(trainsThatFit(175)).toBe(1); // 320×568, with route chips
    expect(trainsThatFit(40)).toBe(1);
  });
});
