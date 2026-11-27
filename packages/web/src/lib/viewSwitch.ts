// The transition between a station's two tracks and its list board (the button by the station name).
//
// Tracks → board: the trains and times fade out, the tracks slide away backwards (green down, orange up: against
// their direction of travel), then the station sign moves up under the header and narrows to the board's sign.
// Only then does the app swap in the board, whose sign is where the moved sign ended, and its list fades in.
// Board → tracks: the list fades out, then the station page plays the same steps in reverse.
//
// With reduced motion the switch is instant.

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.5, 0, 0.75, 0)';
/** What fades: the trains, their times and labels, and anything else on the tracks. */
const CONTENT = '.trains, .more, .trains-empty, .terminus, .line-chips, .going-to';
/** The board sign's vertical padding (board.css), which the narrowed station sign takes on. */
const BOARD_SIGN_PADDING = 14;
/** The station sign's own: its padding and the two next-station rows (track.css). */
const SIGN_PADDING = 4;
const NEIGHBOUR_ROW = 34;

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];

function play(elements: HTMLElement[], keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  return Promise.all(elements.map((el) => el.animate(keyframes, { fill: 'forwards', ...options }).finished)).catch(() => undefined);
}

/** Where the sign is, where it goes (under the header), and how much it narrows by to match the board's sign. */
function signGeometry(root: HTMLElement) {
  const sign = root.querySelector<HTMLElement>('.platform')!;
  const header = root.querySelector<HTMLElement>('.track-view__bar')!;
  const rect = sign.getBoundingClientRect();
  // The board's sign holds the name and the official name; the going-to chip and next stations aren't there.
  const kept = [...sign.querySelectorAll<HTMLElement>('.platform__name, .platform__official')];
  const middle = kept.reduce((sum, el) => sum + el.offsetHeight, 0) + 4 * Math.max(0, kept.length - 1);
  const narrowed = middle + 2 * BOARD_SIGN_PADDING;
  return { sign, rise: header.getBoundingClientRect().bottom - rect.top, shrink: rect.height - narrowed };
}

const SIGN_OPEN: Keyframe = { gridTemplateRows: `${NEIGHBOUR_ROW}px auto ${NEIGHBOUR_ROW}px`, paddingTop: `${SIGN_PADDING}px`, paddingBottom: `${SIGN_PADDING}px` };
const SIGN_NARROW: Keyframe = { gridTemplateRows: '0px auto 0px', paddingTop: `${BOARD_SIGN_PADDING}px`, paddingBottom: `${BOARD_SIGN_PADDING}px` };

/** Tracks → board, on the station page's root. Resolves when the board can take over. */
export async function leaveTracks(root: HTMLElement): Promise<void> {
  if (reducedMotion()) return;
  const height = window.innerHeight;
  // 1. Trains and times.
  await play(all(root, CONTENT), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  // 2. Tracks slide away backwards.
  await Promise.all([
    play(all(root, '.lane--north'), [{ transform: 'none' }, { transform: `translateY(${height}px)` }], { duration: 420, easing: EASE_IN }),
    play(all(root, '.lane--south'), [{ transform: 'none' }, { transform: `translateY(${-height}px)` }], { duration: 420, easing: EASE_IN }),
  ]);
  // 3. The sign moves up under the header…
  const { sign, rise, shrink } = signGeometry(root);
  await play([sign], [{ transform: 'none' }, { transform: `translateY(${rise}px)` }], { duration: 360, easing: EASE_OUT });
  // 4. …and narrows. It sits between two equal halves, so shrinking it moves its top down by half the shrink:
  // the transform takes that back, so it narrows in place.
  await Promise.all([
    play(all(sign, '.neighbours'), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 }),
    play(
      [sign],
      [
        { ...SIGN_OPEN, transform: `translateY(${rise}px)` },
        { ...SIGN_NARROW, transform: `translateY(${rise - shrink / 2}px)` },
      ],
      { duration: 300, easing: EASE_OUT },
    ),
  ]);
}

/**
 * Board → tracks, on the station page's root as it first appears (call before the first paint). Its trains and
 * times stay hidden (the page's `track-view--entering` class, so trains that arrive mid-transition do too) until
 * `reveal`, which takes that class off, then fade in.
 */
export async function enterTracks(root: HTMLElement, reveal: () => void): Promise<void> {
  if (reducedMotion()) return reveal();
  const height = window.innerHeight;
  const { sign, rise, shrink } = signGeometry(root);
  const north = all(root, '.lane--north');
  const south = all(root, '.lane--south');
  // Start where the board left off: tracks away, sign narrowed under the header.
  const lanesAway = [
    ...north.map((el) => el.animate([{ transform: `translateY(${height}px)` }], { fill: 'forwards' })),
    ...south.map((el) => el.animate([{ transform: `translateY(${-height}px)` }], { fill: 'forwards' })),
  ];
  // 1. The sign widens in place, then moves down to the platform.
  await Promise.all([
    play(
      [sign],
      [
        { ...SIGN_NARROW, transform: `translateY(${rise - shrink / 2}px)` },
        { ...SIGN_OPEN, transform: `translateY(${rise}px)` },
      ],
      { duration: 300, easing: EASE_OUT },
    ),
    play(all(sign, '.neighbours'), [{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: 300 }),
  ]);
  await play([sign], [{ transform: `translateY(${rise}px)` }, { transform: 'none' }], { duration: 360, easing: EASE_OUT });
  // 2. Tracks slide back in.
  lanesAway.forEach((a) => a.cancel());
  await Promise.all([
    play(north, [{ transform: `translateY(${height}px)` }, { transform: 'none' }], { duration: 420, easing: EASE_OUT }),
    play(south, [{ transform: `translateY(${-height}px)` }, { transform: 'none' }], { duration: 420, easing: EASE_OUT }),
  ]);
  // 3. Trains and times: held at 0 by the animation while the hiding class comes off, then faded in.
  const content = all(root, CONTENT);
  const fade = play(content, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  reveal();
  await fade;
  for (const el of [sign, ...north, ...south, ...all(root, CONTENT), ...all(sign, '.neighbours')]) {
    el.getAnimations().forEach((a) => a.cancel());
  }
}

/** Board → tracks, first step on the board: its list fades out. */
export async function leaveBoard(root: HTMLElement): Promise<void> {
  if (reducedMotion()) return;
  await play(all(root, '.board__body'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
}
