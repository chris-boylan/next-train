import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { canAddToHomeScreen, isStandalone, useInstallPrompt } from '../lib/install';

const SEEN_KEY = 'welcomeSeen';
const LEAVE_MS = 300;

/**
 * Whether to greet this visitor: only on a first ever visit, in a browser tab, opened on the home page. Someone
 * arriving from a station or help link came for that, and the installed app is past the point of inviting.
 * Without storage we can't remember having shown it, so it isn't shown at all.
 */
export function shouldWelcome(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    if (isStandalone() || ['service', 'station', 'help'].some((p) => params.has(p))) return false;
    if (localStorage.getItem(SEEN_KEY)) return false;
    // Seen as soon as it's shown, so it never comes back, even if the tab is closed on it.
    localStorage.setItem(SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** A quiet full-screen welcome, shown once: the name, what it does, and an invitation to add it to the home screen. */
export function Welcome({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const install = useInstallPrompt();
  const iosTip = canAddToHomeScreen();
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : LEAVE_MS);
  };

  return (
    <div
      className={`welcome${leaving ? ' welcome--leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      tabIndex={-1}
      // Focus starts on the welcome itself, for screen readers, without a focus ring on any one button.
      ref={(el) => el?.focus({ preventScroll: true })}
    >
      {/* The other language, in its own name, as people look for it. */}
      <button className="welcome__lang" onClick={() => setLang(lang === 'en' ? 'ga' : 'en')} lang={lang === 'en' ? 'ga' : 'en'}>
        {lang === 'en' ? 'Gaeilge' : 'English'}
      </button>
      <div className="welcome__body">
        <img className="welcome__icon" src="/icon.svg" alt="" width={72} height={72} />
        <h1 className="welcome__title" id="welcome-title">
          Next Train?
        </h1>
        <p className="welcome__lead">{t.welcome.lead}</p>
      </div>
      <div className="welcome__foot">
        {install ? (
          <>
            <p className="welcome__invite">{t.welcome.invite}</p>
            <button className="chip welcome__install" onClick={() => install().finally(close)}>
              {t.welcome.addToHomeScreen}
            </button>
          </>
        ) : (
          iosTip && <p className="welcome__invite">{t.installTip}</p>
        )}
        <button className="welcome__start" onClick={close}>
          {t.welcome.start}
        </button>
      </div>
    </div>
  );
}
