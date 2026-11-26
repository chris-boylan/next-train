import { useEffect, useRef, useState } from 'react';
import { type Lang, useI18n } from '../lib/i18n';
import { type FavouritesPlace, useFavouritesPlace } from '../lib/prefs';
import { type Theme, useTheme } from '../lib/theme';

/** iPhone/iPad Safari, not already opened from the home screen. iOS has no install prompt, so we explain how. */
function canAddToHomeScreen(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

/** A cog that slides down a small panel with language, light/dark and where-favourites-go choices (and, on iOS, how to install). */
export function OptionsMenu() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [favouritesPlace, setFavouritesPlace] = useFavouritesPlace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="options" ref={rootRef}>
      <button
        className={`options__cog${open ? ' options__cog--open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="options-panel"
        aria-label={t.options}
        title={t.options}
      >
        <CogIcon />
      </button>
      {open && (
        <div className="options__panel" id="options-panel" role="group" aria-label={t.options}>
          <Choice<Lang>
            label={t.language}
            value={lang}
            onChange={setLang}
            // Fixed positions (like light/dark) so options don't jump when tapped; names follow the current
            // language: "English | Irish" or "Béarla | Gaeilge".
            options={(['en', 'ga'] as const).map((value) => ({ value, label: t.languageNames[value] }))}
          />
          <Choice<Theme>
            label={t.appearance}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t.light },
              { value: 'dark', label: t.dark },
            ]}
          />
          <Choice<FavouritesPlace>
            label={t.favouritesPlace}
            value={favouritesPlace}
            onChange={setFavouritesPlace}
            options={[
              { value: 'service', label: t.favouritesInService },
              { value: 'home', label: t.favouritesOnHome },
            ]}
          />
          {canAddToHomeScreen() && (
            <div className="options__row">
              <span className="options__label">{t.install}</span>
              <p className="options__note">{t.installTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="options__row">
      <span className="options__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            className={`segmented__option${value === o.value ? ' segmented__option--on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CogIcon() {
  return (
    <svg className="options__icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10.3 1.5h3.4l.5 2.9 1.6.7 2.4-1.7 2.4 2.4-1.7 2.4.7 1.6 2.9.5v3.4l-2.9.5-.7 1.6 1.7 2.4-2.4 2.4-2.4-1.7-1.6.7-.5 2.9h-3.4l-.5-2.9-1.6-.7-2.4 1.7-2.4-2.4 1.7-2.4-.7-1.6-2.9-.5v-3.4l2.9-.5.7-1.6-1.7-2.4 2.4-2.4 2.4 1.7 1.6-.7.5-2.9ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
      />
    </svg>
  );
}
