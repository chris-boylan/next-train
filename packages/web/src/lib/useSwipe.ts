import { useRef, type TouchEvent } from 'react';

/** How far a finger must travel across, and how much more across than down, to count as a swipe. */
const MIN_DISTANCE = 60;
const MIN_RATIO = 2;

export interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

/**
 * A one-finger swipe across: `onLeft` when the finger moves left (the next page comes in from the right),
 * `onRight` when it moves right. Scrolling down, pinching, and gestures that start in a text field don't count.
 */
export function useSwipe(onLeft: () => void, onRight: () => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number }>();
  return {
    onTouchStart: (e) => {
      const touch = e.touches[0];
      const inField = e.target instanceof HTMLElement && !!e.target.closest('input, textarea');
      start.current = e.touches.length === 1 && touch && !inField ? { x: touch.clientX, y: touch.clientY } : undefined;
    },
    onTouchEnd: (e) => {
      const from = start.current;
      const touch = e.changedTouches[0];
      start.current = undefined;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < MIN_RATIO * Math.abs(dy)) return;
      if (dx < 0) onLeft();
      else onRight();
    },
  };
}
