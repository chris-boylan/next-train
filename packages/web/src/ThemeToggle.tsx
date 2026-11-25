import { useTheme } from './theme';

/** Shows the mode you'd switch to: a moon in light mode, a sun in dark mode. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// Solid icons rather than ☾/☀ text, which most fonts draw too thin next to the heavy type.
function MoonIcon() {
  return (
    <svg className="theme-toggle__icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="theme-toggle__icon" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <g strokeWidth="2.5" strokeLinecap="square">
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
      </g>
    </svg>
  );
}
