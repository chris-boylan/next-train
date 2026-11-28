import type { CSSProperties, ReactNode } from 'react';
import { isCorkCommuter, type TrainCategory } from '@dart-times/core';
import { useTrainIcons } from '../lib/prefs';

/**
 * A train seen head-on, drawn flat and square in a 40 × 52 box, as its real train where we know it:
 * - DART (8100, 8500 and 8600 class): a boxy face, the destination blind over one big square windscreen, a yellow
 *   lower front, lights low in the corners.
 * - InterCity (22000 class): a domed cab with a tall windscreen curving into the roof, a yellow nose, paired lights.
 * - Enterprise (its driving trailer): a cab sloping back at the top, a split windscreen, a purple band on silver.
 * - Cork Commuter (2600 class): a flat, square face with its gangway door between two windscreens, silver with a
 *   green stripe and a yellow front.
 * - NI Railways (CAF Class 3000 and 4000): a rounded cab with a flatter top than the InterCity's, one wide
 *   windscreen, Translink's blue band on silver over a yellow front.
 * - The Luas: a tram, rounder, with its pantograph up to the wire.
 * - Dublin Commuter: the plain box every train had before.
 *
 * Trains come in their full livery (the default), or plain white, black and grey, told apart by shape alone
 * (Options → Train icons). Either way the outline is the same, and a timetabled or untracked train is drawn hollow
 * and dashed with its details faded (track.css), so it never passes for a live one.
 */
export function TrainGlyph({ train }: { train: { category: TrainCategory; destinationCode?: string } }) {
  const [style] = useTrainIcons();
  const colour = style === 'colour';
  const { category } = train;
  if (category === 'luas') return <Tram />;
  if (isCorkCommuter(train)) return <Glyph>{colour ? <CorkLivery /> : <CorkWhite />}</Glyph>;
  if (category === 'nir') return <Glyph>{colour ? <NirLivery /> : <NirWhite />}</Glyph>;
  if (category === 'dart') return <Glyph>{colour ? <DartLivery /> : <DartWhite />}</Glyph>;
  if (category === 'intercity') return <Glyph>{colour ? <InterCityLivery /> : <InterCityWhite />}</Glyph>;
  if (category === 'enterprise') return <Glyph>{colour ? <EnterpriseLivery /> : <EnterpriseWhite />}</Glyph>;
  return <PlainTrain />;
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="train__glyph" viewBox="0 0 40 52" aria-hidden>
      {children}
    </svg>
  );
}

/** The body, filled: white, or a livery colour (`--livery`); hollow trains take the page's background instead. */
const Body = ({ d, livery }: { d: string; livery?: string }) => (
  <path d={d} className={`glyph-body glyph-fill${livery ? ' glyph-livery' : ''}`} style={livery ? ({ '--livery': livery } as CSSProperties) : undefined} />
);
/** The outline, drawn last so details never cover it; dashed on a hollow train. */
const Outline = ({ d }: { d: string }) => <path d={d} className="glyph-outline" />;
/** A livery detail: faded on a hollow train, like the windows. */
const Paint = ({ d, fill }: { d: string; fill: string }) => <path d={d} fill={fill} className="glyph-paint" />;
/** A light in a dark housing, as on the real trains' fronts. */
const Lamp = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={1} className="glyph-window" />
    <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={h - 3} className="glyph-lamp" />
  </>
);
const r = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h-${w}Z`;

// --- DART ---
const DART_BODY = 'M4.5 2.5h31a2 2 0 0 1 2 2v43a2 2 0 0 1-2 2h-31a2 2 0 0 1-2-2v-43a2 2 0 0 1 2-2Z';
const DART_PANEL = 'M2.5 30.5h35v17a2 2 0 0 1-2 2h-31a2 2 0 0 1-2-2Z';
const DartFace = () => (
  <>
    <rect x={11} y={6.5} width={18} height={3} className="glyph-window" />
    <rect x={6} y={12} width={28} height={15} className="glyph-window" />
    <Lamp x={6} y={37} w={8} h={5.5} />
    <Lamp x={26} y={37} w={8} h={5.5} />
    <rect x={17} y={43.5} width={6} height={4} className="glyph-window" />
  </>
);
const DartWhite = () => (
  <>
    <Body d={DART_BODY} />
    <DartFace />
    <Outline d={DART_BODY} />
  </>
);
const DartLivery = () => (
  <>
    <Body d={DART_BODY} livery="#169b62" />
    <Paint d={DART_PANEL} fill="#ffd400" />
    <DartFace />
    <Paint d={r(12, 7.5, 8, 1)} fill="#ff9a1f" />
    <Outline d={DART_BODY} />
  </>
);

// --- InterCity ---
const IC_BODY = 'M3.5 49.5V17C3.5 8.5 10 3.5 20 3.5S36.5 8.5 36.5 17v32.5Z';
const IC_ROOF = 'M3.5 17C3.5 8.5 10 3.5 20 3.5S36.5 8.5 36.5 17v13h-33Z';
const InterCityFace = () => (
  <>
    <path d="M8 26v-9.5C8 11.2 13 8.5 20 8.5s12 2.7 12 8V26Z" className="glyph-window" />
    {[9.5, 30.5].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy={37} r={2.6} className="glyph-window" />
        <circle cx={cx} cy={37} r={1.5} className="glyph-lamp" />
      </g>
    ))}
    {[14.5, 25.5].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy={37} r={1.9} className="glyph-window" />
        <circle cx={cx} cy={37} r={1} className="glyph-lamp" />
      </g>
    ))}
    <rect x={16} y={41} width={8} height={3.5} className="glyph-window" />
  </>
);
const InterCityWhite = () => (
  <>
    <Body d={IC_BODY} />
    <InterCityFace />
    <Outline d={IC_BODY} />
  </>
);
const InterCityLivery = () => (
  <>
    <Body d={IC_BODY} livery="#ffd400" />
    <Paint d={IC_ROOF} fill="#a7a9ac" />
    <Paint d={r(3.5, 44.5, 33, 5)} fill="#00573f" />
    <InterCityFace />
    <Outline d={IC_BODY} />
  </>
);

// --- Enterprise ---
const ENT_BODY = 'M3 49.5V15l6-11.5h22L37 15v34.5Z';
const EnterpriseWindows = () => (
  <>
    <path d="M7 22.5v-7L11 9h8v13.5Z" className="glyph-window" />
    <path d="M21 22.5V9h8l4 6.5v7Z" className="glyph-window" />
    <rect x={17} y={43.5} width={6} height={4} className="glyph-window" />
  </>
);
const EnterpriseWhite = () => (
  <>
    <Body d={ENT_BODY} />
    <EnterpriseWindows />
    <Lamp x={6} y={36} w={7} h={5} />
    <Lamp x={27} y={36} w={7} h={5} />
    <Outline d={ENT_BODY} />
  </>
);
const EnterpriseLivery = () => (
  <>
    <Body d={ENT_BODY} livery="#c9cad3" />
    <Paint d={r(3, 33, 34, 16.5)} fill="#ffd400" />
    <Paint d={r(3, 25.5, 34, 4.5)} fill="#5b2a86" />
    <Paint d={r(3, 30, 34, 2)} fill="#a273d2" />
    <EnterpriseWindows />
    <Lamp x={6} y={36} w={7} h={5} />
    <Lamp x={27} y={36} w={7} h={5} />
    <Outline d={ENT_BODY} />
  </>
);

// --- Cork Commuter (2600 class) ---
const CORK_BODY = 'M5.5 2.5h29a3 3 0 0 1 3 3v41a3 3 0 0 1-3 3h-29a3 3 0 0 1-3-3v-41a3 3 0 0 1 3-3Z';
/** Two windscreens either side of the gangway door, which has its own outline and window; lights and coupler. */
const CorkFace = () => (
  <>
    <rect x={5.5} y={10} width={9} height={14} className="glyph-window" />
    <rect x={25.5} y={10} width={9} height={14} className="glyph-window" />
    <rect x={16} y={7} width={8} height={35} className="glyph-door" />
    <rect x={17.3} y={9.5} width={5.4} height={12} className="glyph-window" />
    <Lamp x={5} y={36} w={7} h={5} />
    <Lamp x={28} y={36} w={7} h={5} />
    <rect x={17} y={44} width={6} height={3.5} className="glyph-window" />
  </>
);
const CorkWhite = () => (
  <>
    <Body d={CORK_BODY} />
    <CorkFace />
    <Outline d={CORK_BODY} />
  </>
);
const CorkLivery = () => (
  <>
    <Body d={CORK_BODY} livery="#c9cad3" />
    <Paint d={r(2.5, 30.5, 35, 19)} fill="#ffd400" />
    <Paint d={r(2.5, 27, 35, 2.5)} fill="#00573f" />
    <CorkFace />
    <Outline d={CORK_BODY} />
  </>
);

// --- NI Railways (CAF Class 3000 and 4000) ---
const NIR_BODY = 'M3.5 49.5V14c0-6 3.5-10 10-10.5h13c6.5.5 10 4.5 10 10.5v35.5Z';
const NirFace = () => (
  <>
    <path d="M6.5 24V15c0-3.5 2-6 6-6.5h15c4 .5 6 3 6 6.5v9c-4.5 2-9 3-13.5 3S11 26 6.5 24Z" className="glyph-window" />
    <Lamp x={6} y={36} w={8} h={4.5} />
    <Lamp x={26} y={36} w={8} h={4.5} />
    <rect x={16.5} y={43.5} width={7} height={3.5} className="glyph-window" />
  </>
);
const NirWhite = () => (
  <>
    <Body d={NIR_BODY} />
    <NirFace />
    <Outline d={NIR_BODY} />
  </>
);
const NirLivery = () => (
  <>
    <Body d={NIR_BODY} livery="#d4d6db" />
    <Paint d={r(3.5, 31, 33, 18.5)} fill="#ffd400" />
    <Paint d={r(3.5, 26.5, 33, 4.5)} fill="#1e3f8a" />
    <NirFace />
    <Outline d={NIR_BODY} />
  </>
);

/** Every other train: the plain box (Dublin Commuter). */
function PlainTrain() {
  return (
    <svg className="train__glyph" viewBox="0 0 40 52" aria-hidden>
      <rect x="2" y="2" width="36" height="48" rx="3" className="glyph-body" />
      <rect x="7" y="9" width="26" height="14" className="glyph-window" />
      <rect x="8" y="36" width="6" height="5" className="glyph-light" />
      <rect x="26" y="36" width="6" height="5" className="glyph-light" />
    </svg>
  );
}

/** A Luas tram: rounder, with a tall windscreen and the pantograph on its roof reaching up to the wire. */
function Tram() {
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
