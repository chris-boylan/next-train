// Local development: builds the same timetable files as the daily job into packages/web/.timetable (git-ignored,
// never part of a build), which the Vite dev server serves at /timetable/... like CloudFront. Usage:
// npm run timetable:local
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_STATIONS, irishDate, timetableFiles } from '@dart-times/core';
import { downloadGtfs } from '../src/gtfs';

const outDir = fileURLToPath(new URL('../../web/.timetable/', import.meta.url));
const now = Date.now();
const dates = [irishDate(now, -1), irishDate(now), irishDate(now, 1)];
const files = timetableFiles(await downloadGtfs(), dates, ALL_STATIONS, new Date(now).toISOString());
for (const [path, body] of files) {
  // Paths are timetable/<date>/<code>.json; the folder itself stands in for timetable/.
  const file = outDir + path.replace(/^timetable\//, '');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}
console.log(`Wrote ${files.size} timetable files for ${dates.join(', ')} to ${outDir}`);
