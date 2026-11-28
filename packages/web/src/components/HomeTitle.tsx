import { useI18n } from '../lib/i18n';
import type { HomeMode } from '../lib/prefs';

interface Props {
  mode: HomeMode;
  onChange: (mode: HomeMode) => void;
  /** Slide the title in from its page's side: after switching, not every time the page opens. */
  slideIn?: boolean;
}

/**
 * The home page's title, "Next Train?" or "Next Tram?", with a small indicator beside it: two dots for the two
 * pages, and the other page's name, which switches to it (as does swiping across the page).
 */
export function HomeTitle({ mode, onChange, slideIn }: Props) {
  const { t } = useI18n();
  const other: HomeMode = mode === 'train' ? 'tram' : 'train';
  return (
    <div className="home-title">
      <h1 key={mode} className={`home-title__name${slideIn ? ` home-title__name--from-${mode === 'tram' ? 'right' : 'left'}` : ''}`}>
        {mode === 'tram' ? t.nextTram : t.nextTrain}
      </h1>
      <button className={`home-title__switch home-title__switch--${mode}`} onClick={() => onChange(other)} aria-label={t.homeSwitch[other]}>
        <span className="home-title__dots" aria-hidden>
          <span className={`home-title__dot${mode === 'train' ? ' home-title__dot--on' : ''}`} />
          <span className={`home-title__dot${mode === 'tram' ? ' home-title__dot--on' : ''}`} />
        </span>
        <span className="home-title__other" aria-hidden>
          {mode === 'train' ? `${t.homeModes.tram} ›` : `‹ ${t.homeModes.train}`}
        </span>
      </button>
    </div>
  );
}
