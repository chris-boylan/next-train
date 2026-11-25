import { useTheme } from './theme';

/** Shows the mode you'd switch to: a moon in light mode, a sun in dark mode. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
