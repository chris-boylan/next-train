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

/**
 * Each half of the page draws its own pieces of track, so sliding them as they are would move four pieces
 * with a gap where the sign is. Instead each colour gets one line for the slide: copies of its pieces plus a
 * strip of track behind the sign joining them, in a layer under the sign. That layer clips to the tracks, so a
 * line leaving goes out under the header rather than over it. The real pieces are hidden meanwhile; `restore`
 * puts them back.
 */
function joinedTracks(root: HTMLElement) {
  const tracks = root.querySelector<HTMLElement>('.tracks')!;
  const box = tracks.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'joined-tracks';
  layer.setAttribute('aria-hidden', 'true');
  tracks.append(layer);
  const lines = (['north', 'south'] as const).map((side) => {
    const pieces = all(tracks, `.lane--${side}`);
    const line = document.createElement('div');
    line.className = 'joined-track';
    const rects = pieces.map((p) => p.getBoundingClientRect());
    for (const [i, piece] of pieces.entries()) {
      const copy = piece.cloneNode(true) as HTMLElement;
      const r = rects[i]!;
      Object.assign(copy.style, { top: `${r.top - box.top}px`, bottom: 'auto', height: `${r.height}px` });
      line.append(copy);
    }
    // The strip behind the sign, between the two pieces, in the shaft's colour and width.
    const shaft = pieces[0]?.querySelector<HTMLElement>('.lane__shaft');
    if (shaft && rects.length === 2) {
      const [upper, lower] = [...rects].sort((a, b) => a.top - b.top) as [DOMRect, DOMRect];
      const s = shaft.getBoundingClientRect();
      const strip = document.createElement('div');
      Object.assign(strip.style, {
        position: 'absolute',
        left: `${s.left - box.left}px`,
        width: `${s.width}px`,
        top: `${upper.bottom - box.top - 1}px`,
        height: `${lower.top - upper.bottom + 2}px`,
        background: getComputedStyle(shaft).backgroundColor,
      });
      line.append(strip);
    }
    layer.append(line);
    return { side, line, pieces };
  });
  for (const { pieces } of lines) for (const p of pieces) p.style.visibility = 'hidden';
  const restore = () => {
    layer.remove();
    for (const { pieces } of lines) for (const p of pieces) p.style.visibility = '';
  };
  return { north: lines[0]!.line, south: lines[1]!.line, restore };
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
  // 2. The two tracks slide away backwards, each as one line.
  const joined = joinedTracks(root);
  await Promise.all([
    play([joined.north], [{ transform: 'none' }, { transform: `translateY(${height}px)` }], { duration: 420, easing: EASE_IN }),
    play([joined.south], [{ transform: 'none' }, { transform: `translateY(${-height}px)` }], { duration: 420, easing: EASE_IN }),
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
  // Start where the board left off: the two tracks (each as one line) away, the sign narrowed under the header.
  const joined = joinedTracks(root);
  joined.north.style.transform = `translateY(${height}px)`;
  joined.south.style.transform = `translateY(${-height}px)`;
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
  // 2. The two tracks slide back in, then the real pieces take over.
  await Promise.all([
    play([joined.north], [{ transform: `translateY(${height}px)` }, { transform: 'none' }], { duration: 420, easing: EASE_OUT }),
    play([joined.south], [{ transform: `translateY(${-height}px)` }, { transform: 'none' }], { duration: 420, easing: EASE_OUT }),
  ]);
  joined.restore();
  // 3. Trains and times: held at 0 by the animation while the hiding class comes off, then faded in.
  const content = all(root, CONTENT);
  const fade = play(content, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  reveal();
  await fade;
  for (const el of [sign, ...all(root, CONTENT), ...all(sign, '.neighbours')]) {
    el.getAnimations().forEach((a) => a.cancel());
  }
}

/** Board → tracks, first step on the board: its list fades out. */
export async function leaveBoard(root: HTMLElement): Promise<void> {
  if (reducedMotion()) return;
  await play(all(root, '.board__body'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
}
