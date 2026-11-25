import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A panel that slides up from the bottom over the current screen. Closes on ✕, Escape or a tap outside. */
export function Sheet({ title, onClose, children }: Props) {
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

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          <button ref={closeRef} className="sheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>
  );
}
