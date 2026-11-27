// Where each map was scrolled to, so going back from a station returns to the same part of the map. Opening a
// map afresh (from the service list) forgets it, so the map starts at the top.
import { useLayoutEffect, useRef } from 'react';

const positions = new Map<string, number>();

/** Start the map called `key` at the top next time it opens. */
export const forgetScroll = (key: string) => positions.delete(key);

/** A ref for a screen's scroll area (.screen__scroll) that remembers its position under `key`. */
export function useScrollMemory<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = positions.get(key) ?? 0;
    const save = () => positions.set(key, el.scrollTop);
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [key]);
  return ref;
}
