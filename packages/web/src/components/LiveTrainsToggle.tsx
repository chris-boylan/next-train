import { useI18n } from '../lib/i18n';

interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** First load after turning on: the box pulses until the trains arrive. */
  loading?: boolean;
  /** The last fetch failed: a short note beside the switch, rather than an error screen. */
  failed?: boolean;
}

/** The small "Live" switch on a line map's top strip. */
export function LiveTrainsToggle({ on, onChange, loading, failed }: Props) {
  const { t } = useI18n();
  return (
    <>
      <button
        className={`live-toggle__switch${on ? ' live-toggle__switch--on' : ''}${loading ? ' live-toggle__switch--loading' : ''}`}
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
      >
        <span className="live-toggle__knob" aria-hidden />
        {t.live}
      </button>
      {on && failed && <span className="live-toggle__note">{t.liveTrainsUnavailable}</span>}
    </>
  );
}
