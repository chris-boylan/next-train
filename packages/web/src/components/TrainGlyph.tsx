interface Props {
  /** A Luas tram rather than a train. */
  tram?: boolean;
}

/**
 * A DART seen head-on, drawn flat and square; or a Luas tram: rounder, with a tall windscreen and the pantograph
 * on its roof reaching up to the wire. Both fill the same box, so they sit on the tracks alike.
 */
export function TrainGlyph({ tram }: Props) {
  if (tram) {
    return (
      <svg className="train__glyph train__glyph--tram" viewBox="0 0 40 52" aria-hidden>
        <path d="M13 2h14M20 2l-5 6h10Z" className="glyph-pantograph" />
        <rect x="3" y="9" width="34" height="41" rx="9" className="glyph-body" />
        <rect x="8" y="14" width="24" height="18" rx="5" className="glyph-window" />
        <rect x="9" y="39" width="5" height="4" rx="2" className="glyph-light" />
        <rect x="26" y="39" width="5" height="4" rx="2" className="glyph-light" />
      </svg>
    );
  }
  return (
    <svg className="train__glyph" viewBox="0 0 40 52" aria-hidden>
      <rect x="2" y="2" width="36" height="48" rx="3" className="glyph-body" />
      <rect x="7" y="9" width="26" height="14" className="glyph-window" />
      <rect x="8" y="36" width="6" height="5" className="glyph-light" />
      <rect x="26" y="36" width="6" height="5" className="glyph-light" />
    </svg>
  );
}
