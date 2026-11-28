import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Caps, useI18n } from '../lib/i18n';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides up from the bottom over the current screen. Closes on ✕, Escape or a tap outside. Drawn at
 * the top of the page (a portal), so it always spans the whole screen: opened from inside a map, an ancestor
 * there would otherwise hold its fixed position to the map's box.
 */
export function Sheet({ title, onClose, children }: Props) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  // The parent re-renders every second (the clock), so keep the latest onClose in a ref and
  // only focus once, on open, rather than re-running this effect and stealing focus each tick.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet__header">
          <h2 className="sheet__title">
            <Caps text={title} />
          </h2>
          <button ref={closeRef} className="sheet__close" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
