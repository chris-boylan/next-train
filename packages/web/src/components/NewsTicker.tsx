import { type CSSProperties, useState } from 'react';
import { useI18n } from '../lib/i18n';

export interface TickerItem {
  key: string;
  /** Who it's about (a line's name), in its colour. */
  label: string;
  colour: string;
  message: string;
}

interface Props {
  items: TickerItem[];
  /** Where the full story is: tapping the ticker opens it. */
  href: string;
}

/** Scrolling speed, so short and long news read alike. */
const PX_PER_SECOND = 45;
/** Roughly how wide a character is at the ticker's size, to time a loop without measuring it. */
const PX_PER_CHAR = 7;

/**
 * A line of news scrolling across, like a station's ticker: each item's label in its colour, then its message,
 * on a loop (two copies, so it runs on seamlessly). It's a link to the full story. With reduced motion it stands
 * still and wraps instead. Screen readers get the news once, from the link's label, not the scrolling copies.
 *
 * News that arrives after the page (it takes a moment to load) slides down into place, opening a gap for itself
 * rather than jolting the map down; news already known when the page opens is simply there.
 */
export function NewsTicker({ items, href }: Props) {
  const { t } = useI18n();
  const [knownAtOpen] = useState(items.length > 0);
  if (!items.length) return null;
  const text = items.map((i) => `${i.label}: ${i.message}`).join('. ');
  const seconds = Math.max(10, ((text.length + items.length * 6) * PX_PER_CHAR) / PX_PER_SECOND);
  const run = (copy: number) => (
    <span className="ticker__run" key={copy}>
      {items.map((item) => (
        <span key={item.key} className="ticker__item">
          <span className="ticker__label" style={{ background: item.colour }}>
            {item.label}
          </span>
          {item.message}
        </span>
      ))}
    </span>
  );
  return (
    <div className={`ticker-slot${knownAtOpen ? '' : ' ticker-slot--arriving'}`}>
      <a
        className="ticker"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t.serviceNews}: ${text}. ${t.serviceNewsMore}`}
      >
        <span className="ticker__window" aria-hidden>
          <span className="ticker__track" style={{ '--ticker-duration': `${seconds}s` } as CSSProperties}>
            {run(0)}
            {run(1)}
          </span>
        </span>
        <span className="ticker__more" aria-hidden>
          ›
        </span>
      </a>
    </div>
  );
}
