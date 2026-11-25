import { type Departure, joinList } from '@dart-times/core';

/** "5 trains to Malahide hidden": says what the going-to filter removed, so nothing silently disappears. */
export function HiddenNote({ all, shown }: { all: Departure[]; shown: Departure[] }) {
  const hidden = all.filter((d) => !shown.includes(d));
  if (!hidden.length) return null;
  const destinations = [...new Set(hidden.map((d) => d.destination))];
  return (
    <p className="hidden-note">
      {hidden.length} train{hidden.length === 1 ? '' : 's'} to {joinList(destinations)} hidden
    </p>
  );
}
