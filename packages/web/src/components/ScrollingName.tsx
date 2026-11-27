import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { Caps } from '../lib/i18n';

/** How fast a long name slides, in px a second: slow enough to read as it goes. */
const SPEED = 28;
/** The slides take this share of each cycle (see `name-scroll` in track.css); the rest is pauses at each end. */
const MOVING_SHARE = 0.7;

/**
 * A station sign's name on one line. When it's too long for the screen it slides across to show the end, pauses,
 * and slides back, over and over. With reduced motion it wraps instead (track.css). The whole name is always in
 * the page, so screen readers read it as usual.
 */
export function ScrollingName({ text }: { text: string }) {
  const clipRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    const inner = textRef.current;
    if (!clip || !inner) return;
    const measure = () => {
      const by = Math.ceil(inner.scrollWidth - clip.clientWidth);
      setOverflow(by > 1 ? by : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    observer.observe(inner);
    // The web font can arrive after the first measure, changing the name's width.
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [text]);

  const style = overflow
    ? ({ '--name-shift': `${-overflow}px`, '--name-cycle': `${Math.max(6, (2 * overflow) / SPEED / MOVING_SHARE)}s` } as CSSProperties)
    : undefined;
  return (
    <span ref={clipRef} className={`scrolling-name${overflow ? ' scrolling-name--moving' : ''}`} style={style}>
      <span ref={textRef} className="scrolling-name__text">
        <Caps text={text} />
      </span>
    </span>
  );
}
