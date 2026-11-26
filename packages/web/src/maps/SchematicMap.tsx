import type { Service } from '@dart-times/core';
import { useI18n } from '../lib/i18n';
import { PositionedMap } from './PositionedMap';
import type { Schematic } from './data/schematics';

interface Props {
  service: Service;
  schematic: Schematic;
  favouriteCodes: string[];
  currentCode?: string;
  onSelect: (code: string) => void;
}

/** A service's map drawn from hand-placed positions (see schematics.ts). */
export function SchematicMap({ service, schematic, favouriteCodes, currentCode, onSelect }: Props) {
  const { t, stationName } = useI18n();
  const { paths, termini } = service.line;

  const unique = new Map<string, [string, string]>();
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) unique.set([path[i - 1]!, path[i]!].sort().join('|'), [path[i - 1]!, path[i]!]);
  }
  const degree = new Map<string, number>();
  for (const [a, b] of unique.values()) for (const c of [a, b]) degree.set(c, (degree.get(c) ?? 0) + 1);
  // Circles for ends of lines, junctions and turn-backs (e.g. Cork); ticks for the rest.
  const major = (code: string) =>
    degree.get(code) !== 2 || termini.Northbound.includes(code) || termini.Southbound.includes(code);
  const byCode = new Map(service.stations.map((s) => [s.code, s]));

  return (
    <PositionedMap
      schematic={schematic}
      edges={[...unique.values()]}
      codes={service.stations.map((s) => s.code)}
      name={(code) => stationName(byCode.get(code)!)}
      major={major}
      favouriteCodes={favouriteCodes}
      currentCode={currentCode}
      onSelect={onSelect}
      label={t.mapLabel}
    />
  );
}
