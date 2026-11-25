import { useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'dart-times:theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY);
    return ORDER.includes(stored as ThemePreference) ? (stored as ThemePreference) : 'system';
  } catch {
    return 'system';
  }
}

/** `data-theme` on <html> overrides the phone setting; without it, CSS follows prefers-color-scheme. */
export function applyTheme(preference: ThemePreference = readPreference()): void {
  if (preference === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
}

/** The viewer's theme choice, cycling Auto → Light → Dark. Storage failures just mean it isn't remembered. */
export function useTheme() {
  const [preference, setPreference] = useState(readPreference);
  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!;
    setPreference(next);
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Applied for this visit only.
    }
  };
  return { preference, cycle };
}
