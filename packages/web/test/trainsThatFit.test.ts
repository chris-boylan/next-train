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

  it('counts the taller "Last today" row and the break before tomorrow, so the last one never runs under the header', () => {
    // Three trains need 80 + 68 + 68, plus the "more" link and padding: 260. Make the second today's last (+16)
    // and the third tomorrow's first, after the break (+26), and they need 302.
    expect(trainsThatFit(270)).toBe(3);
    expect(trainsThatFit(270, [0, 16, 26])).toBe(2);
    expect(trainsThatFit(302, [0, 16, 26])).toBe(3);
    // Today's last as the next train is the taller next row.
    expect(trainsThatFit(140, [16])).toBe(1);
  });
});
