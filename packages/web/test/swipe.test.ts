import { describe, expect, it } from 'vitest';
import { swipeDirection } from '../src/lib/useSwipe';

const at = (x: number, y: number) => ({ x, y });

describe('swiping between Next Train? and Next Tram?', () => {
  it('reads a long sideways stroke as a swipe, and which way it went', () => {
    expect(swipeDirection(at(300, 400), at(120, 410))).toBe('left');
    expect(swipeDirection(at(80, 400), at(260, 380))).toBe('right');
  });

  it('ignores short strokes, so a tap or a nudge does nothing', () => {
    expect(swipeDirection(at(200, 400), at(160, 400))).toBeUndefined();
  });

  it('ignores strokes that are mostly down or up, so scrolling a map never switches page', () => {
    // 80 px across but 60 down: not twice as much across as down.
    expect(swipeDirection(at(200, 400), at(120, 460))).toBeUndefined();
    expect(swipeDirection(at(200, 400), at(205, 100))).toBeUndefined();
  });
});
