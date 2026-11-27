// Local development: builds the same timetable files as the daily job into packages/web/.timetable (git-ignored,
// never part of a build), which the Vite dev server serves at /timetable/... like CloudFront. Usage:
//   npm run timetable:local
//   NIR_TIMETABLE=path/to/nir-release.zip npm run timetable:local   (or the .xml inside it; relative to where you ran npm)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_STATIONS, buildNirTimetable, buildTimetable, irishDate, type TimetableSource, timetableFiles } from '@dart-times/core';
import { downloadGtfs } from '../src/gtfs';
import { readNirFile } from '../src/nirTimetable';

const outDir = fileURLToPath(new URL('../../web/.timetable/', import.meta.url));
const now = Date.now();
const dates = [irishDate(now, -1), irishDate(now), irishDate(now, 1)];

const gtfs = await downloadGtfs();
const sources: TimetableSource[] = [(date) => buildTimetable(gtfs, date, ALL_STATIONS)];
const nirPath = process.env.NIR_TIMETABLE && resolve(process.env.INIT_CWD ?? process.cwd(), process.env.NIR_TIMETABLE);
if (nirPath) {
  const nir = readNirFile(readFileSync(nirPath));
  sources.push((date) => buildNirTimetable(nir, date, ALL_STATIONS));
  console.log(`NIR timetable from ${nirPath}, valid until ${nir.validUntil}`);
} else {
  console.log('No NIR timetable (set NIR_TIMETABLE=path/to/release.zip to include it)');
}

const files = timetableFiles(sources, dates, new Date(now).toISOString());
for (const [path, body] of files) {
  // Paths are timetable/<date>/<code>.json; the folder itself stands in for timetable/.
  const file = outDir + path.replace(/^timetable\//, '');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}
console.log(`Wrote ${files.size} timetable files for ${dates.join(', ')} to ${outDir}`);
