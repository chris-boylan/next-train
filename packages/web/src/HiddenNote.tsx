import type { Departure } from '@dart-times/core';
import { useI18n } from './i18n';

/** "5 trains to Malahide hidden": says what the going-to filter removed, so nothing silently disappears. */
export function HiddenNote({ all, shown }: { all: Departure[]; shown: Departure[] }) {
  const { t, destinationName, list } = useI18n();
  const hidden = all.filter((d) => !shown.includes(d));
  if (!hidden.length) return null;
  const destinations = [...new Set(hidden.map(destinationName))];
  return <p className="hidden-note">{t.hidden(hidden.length, list(destinations))}</p>;
}
