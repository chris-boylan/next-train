import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FEEDBACK_LIMITS, SIGNIFICANT_DELAY_MINS } from '@dart-times/core';
import { FeedbackError, sendFeedback } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';
import { useI18n } from '../lib/i18n';

type Status = 'idle' | 'sending' | 'sent' | 'failed' | 'tooMany';

/** Help, privacy and a feedback form, opened from the options cog (or a `?help` link). */
export function HelpPage({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const h = t.help;

  // Opened over the station page, which locks scrolling: lift the lock while help is open, then put it back.
  useEffect(() => {
    const root = document.documentElement;
    const wasLocked = root.classList.contains('scroll-locked');
    root.classList.remove('scroll-locked');
    window.scrollTo(0, 0);
    return () => {
      if (wasLocked) root.classList.add('scroll-locked');
    };
  }, []);

  return (
    <div className="picker help">
      <header className="picker__header">
        <div className="picker__title">
          <button className="chip" onClick={onBack}>
            ‹ {t.close}
          </button>
        </div>
        <h1>{h.title}</h1>
      </header>

      <section className="help__section" aria-labelledby="help-reading">
        <h2 id="help-reading">{h.readingTitle}</h2>
        <p>{h.readingIntro}</p>
        <ul className="help__legend">
          <li>
            <span className="help__sample" aria-hidden>
              <Arrow direction="up" />
            </span>
            {h.upArrow}
          </li>
          <li>
            <span className="help__sample" aria-hidden>
              <Arrow direction="down" />
            </span>
            {h.downArrow}
          </li>
          <li>
            <span className="help__sample train__due" aria-hidden>
              5<span className="train__unit">{t.min}</span>
            </span>
            {h.due}
          </li>
          <li>
            <span className="help__sample train__meta" aria-hidden>
              <s className="train__scheduled">18:16</s>
            </span>
            {h.scheduled}
          </li>
          <li>
            <span className="help__sample train__meta" aria-hidden>
              <span className="late late--minor">+4</span>
            </span>
            {h.minor}
          </li>
          <li>
            <span className="help__sample train__meta" aria-hidden>
              <span className="late late--major">+{SIGNIFICANT_DELAY_MINS}</span>
            </span>
            {h.major(SIGNIFICANT_DELAY_MINS)}
          </li>
          <li>
            <span className="help__sample train__meta" aria-hidden>
              <span className="train__expected">18:20</span>
            </span>
            {h.expected}
          </li>
        </ul>
        <p>{h.stale}</p>
        <p>{h.boards}</p>
      </section>

      <section className="help__section" aria-labelledby="help-tips">
        <h2 id="help-tips">{h.tipsTitle}</h2>
        <dl className="help__tips">
          {h.tips.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help__section" aria-labelledby="help-data">
        <h2 id="help-data">{h.dataTitle}</h2>
        {h.data.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </section>

      <section className="help__section" aria-labelledby="help-privacy">
        <h2 id="help-privacy">{h.privacyTitle}</h2>
        <ul className="help__list">
          {h.privacy.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </section>

      <section className="help__section" aria-labelledby="help-feedback">
        <h2 id="help-feedback">{h.feedbackTitle}</h2>
        <FeedbackForm lang={lang} />
      </section>

      <section className="help__section" aria-labelledby="help-about">
        <h2 id="help-about">{h.aboutTitle}</h2>
        <p>{h.about}</p>
        <p>{h.design}</p>
        <p className="help__version">{h.version(__APP_VERSION__)}</p>
      </section>
    </div>
  );
}

function FeedbackForm({ lang }: { lang: string }) {
  const { t } = useI18n();
  const h = t.help;
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const openedAt = useRef(Date.now());

  if (status === 'sent') {
    return (
      <div className="help__sent" role="status">
        <p>{h.sent}</p>
        <button
          className="chip"
          onClick={() => {
            setMessage('');
            setStatus('idle');
            openedAt.current = Date.now();
          }}
        >
          {h.sendAnother}
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await sendFeedback(getDeviceId(), {
        message,
        email: email.trim(),
        website,
        elapsedMs: Date.now() - openedAt.current,
        lang,
        appVersion: __APP_VERSION__,
      });
      setStatus('sent');
    } catch (err) {
      setStatus(err instanceof FeedbackError && err.tooMany ? 'tooMany' : 'failed');
    }
  };

  const tooShort = message.trim().length < FEEDBACK_LIMITS.minMessage;
  // The browser's own email check (type="email"), plus a dot in the domain, as the server requires.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <form className="help__form" onSubmit={submit}>
      <p>{h.feedbackIntro}</p>
      <label className="help__field">
        <span>{h.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={FEEDBACK_LIMITS.maxMessage}
          required
          aria-describedby="feedback-count"
        />
        <span id="feedback-count" className={`help__count${message.length >= FEEDBACK_LIMITS.maxMessage ? ' help__count--full' : ''}`}>
          {h.characters(message.length, FEEDBACK_LIMITS.maxMessage)}
        </span>
      </label>
      <label className="help__field">
        <span>{h.email}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
          maxLength={FEEDBACK_LIMITS.maxEmail}
          required
          aria-invalid={email.trim() !== '' && !emailOk}
        />
        {email.trim() !== '' && !emailOk && <span className="help__field-error">{h.emailInvalid}</span>}
      </label>
      {/* Honeypot: hidden from people and screen readers; bots tend to fill every field. */}
      <input
        className="help__trap"
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      {status === 'failed' && <p className="help__error" role="alert">{h.failed}</p>}
      {status === 'tooMany' && <p className="help__error" role="alert">{h.tooMany}</p>}
      <button className="help__send" type="submit" disabled={status === 'sending' || tooShort || !emailOk}>
        {status === 'sending' ? h.sending : h.send}
      </button>
    </form>
  );
}

/** The station page's arrows, small: shaft and head in the track colour. */
function Arrow({ direction }: { direction: 'up' | 'down' }) {
  const fill = direction === 'up' ? 'var(--north)' : 'var(--south)';
  const d = direction === 'up' ? 'M12 0 L24 12 H17 V32 H7 V12 H0 Z' : 'M7 0 H17 V20 H24 L12 32 L0 20 H7 Z';
  return (
    <svg viewBox="0 0 24 32" width="18" height="24">
      <path d={d} fill={fill} />
    </svg>
  );
}
