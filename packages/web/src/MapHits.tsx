interface Props {
  width: number;
  height: number;
  points: { code: string; x: number; y: number }[];
  onSelect: (code: string) => void;
}

/** Tap target radius: comfortably bigger than a dot or tick, but less than half the closest station gap. */
const HIT = 14;

/**
 * Invisible tap targets over each station's dot or tick, drawn above the name buttons so tapping a dot
 * always opens that station, even where a neighbouring name overlaps it. Pointer and touch only: the
 * name buttons are the accessible way in, so this layer is hidden from assistive tech.
 */
export function MapHits({ width, height, points, onSelect }: Props) {
  return (
    <svg className="line-map__svg line-map__hits" width={width} height={height} aria-hidden>
      {points.map((p) => (
        <circle key={p.code} cx={p.x} cy={p.y} r={HIT} className="line-map__hit"
          data-code={p.code} onClick={() => onSelect(p.code)} />
      ))}
    </svg>
  );
}
