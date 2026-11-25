import { type ThemePreference, useTheme } from './theme';

const LABELS: Record<ThemePreference, { icon: string; name: string }> = {
  system: { icon: 'A', name: 'Auto (follows your phone)' },
  light: { icon: '☀', name: 'Light' },
  dark: { icon: '☾', name: 'Dark' },
};

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const { icon, name } = LABELS[preference];
  return (
    <button className="theme-toggle" onClick={cycle} aria-label={`Theme: ${name}. Tap to change.`} title={`Theme: ${name}`}>
      <span aria-hidden>{icon}</span>
    </button>
  );
}
