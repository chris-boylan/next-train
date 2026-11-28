import { type ReactNode, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { type IosInstall, iosInstall, isStandalone, useInstallPrompt } from '../lib/install';

const SEEN_KEY = 'welcomeSeen';
const LEAVE_MS = 300;

/**
 * Whether to greet this visitor: only on a first ever visit, in a browser tab, opened on the home page. Someone
 * arriving from a station or help link came for that, and the installed app is past the point of inviting.
 * Without storage we can't remember having shown it, so it isn't shown at all. `?welcome` always shows it, and
 * `?welcome=ios`, `?welcome=ios-classic` or `?welcome=android` show that phone's version in any browser.
 */
export function shouldWelcome(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    // ?welcome shows it again, for trying it out.
    if (params.has('welcome')) return true;
    if (isStandalone() || ['service', 'station', 'help'].some((p) => params.has(p))) return false;
    if (localStorage.getItem(SEEN_KEY)) return false;
    // Seen as soon as it's shown, so it never comes back, even if the tab is closed on it.
    localStorage.setItem(SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** Which install help to show: a preview's choice (`?welcome=ios` etc.), else this browser's. */
function installHelp(canPrompt: boolean): 'prompt' | IosInstall | undefined {
  const preview = new URLSearchParams(location.search).get('welcome');
  if (preview === 'ios') return 'safari';
  if (preview === 'ios-classic') return 'safariClassic';
  if (preview === 'android') return 'prompt';
  return canPrompt ? 'prompt' : iosInstall();
}

/** A quiet full-screen welcome, shown once: the name, what it does, and an invitation to add it to the home screen. */
export function Welcome({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useI18n();
  const install = useInstallPrompt();
  const help = installHelp(!!install);
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : LEAVE_MS);
  };
  const steps = help === 'safari' ? t.welcome.iosSteps : help === 'safariClassic' ? t.welcome.iosClassicSteps : undefined;

  return (
    <div
      className={`welcome${leaving ? ' welcome--leaving' : ''}${steps ? ' welcome--steps' : ''}`}
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
        {help === 'prompt' ? (
          <>
            <p className="welcome__invite">{t.welcome.invite}</p>
            <button className="chip welcome__install" onClick={() => (install ? install().finally(close) : close())}>
              {t.welcome.addToHomeScreen}
            </button>
          </>
        ) : steps ? (
          <>
            <h2 className="welcome__steps-title">{t.welcome.invite}</h2>
            <ol className="welcome__steps">
              {steps.map((step, i) => (
                <li key={step.text} className="welcome__step">
                  <span className="welcome__step-number" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="welcome__step-text">{step.text}</span>
                  <StepIcon icon={step.icon} />
                </li>
              ))}
            </ol>
          </>
        ) : (
          help === 'other' && <p className="welcome__invite">{t.installTip}</p>
        )}
        <button className="welcome__start" onClick={close}>
          {t.welcome.start}
        </button>
        {/* Points down at where to start in Safari's toolbar: the ≡ button at the bottom left (iOS 26), or Share in
            the middle (older). */}
        {steps && (
          <span className={`welcome__pointer welcome__pointer--${help === 'safari' ? 'menu' : 'share'}`} aria-hidden>
            <svg viewBox="0 0 24 32" width="24" height="32">
              <path d="M12 2v26M3 19l9 9 9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

/** Small drawings of Safari's own buttons, so each step looks like what to tap. */
function StepIcon({ icon }: { icon: 'menu' | 'share' | 'more' | 'add' }) {
  const paths: Record<typeof icon, ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    share: (
      <>
        <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
        <path d="M8 10H6v11h12V10h-2" />
      </>
    ),
    more: <path d="M6 9l6 6 6-6" />,
    add: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
  };
  return (
    <svg className="welcome__step-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon]}
      </g>
    </svg>
  );
}
