import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'dart-times:theme';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (darkQuery().matches ? 'dark' : 'light');

/** The viewer's override, if any. Without one the app follows the phone's setting. */
function readOverride(): Theme | undefined {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : undefined;
  } catch {
    return undefined;
  }
}

function writeOverride(theme: Theme | undefined): void {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    // Applied for this visit only.
  }
}

/** `data-theme` on <html> overrides the phone setting; without it, CSS follows prefers-color-scheme. */
export function applyTheme(override: Theme | undefined = readOverride()): void {
  if (override) document.documentElement.dataset.theme = override;
  else delete document.documentElement.dataset.theme;
}

/** The theme in use, and a setter. Choosing the phone's own setting drops the override so the app follows the phone again. */
export function useTheme() {
  const [override, setOverride] = useState(readOverride);
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    const query = darkQuery();
    const onChange = () => setSystem(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = override ?? system;
  const setTheme = (next: Theme) => {
    const nextOverride = next === system ? undefined : next;
    setOverride(nextOverride);
    writeOverride(nextOverride);
    applyTheme(nextOverride);
  };
  return { theme, setTheme };
}
