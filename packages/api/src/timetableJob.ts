// The daily timetable job (EventBridge, about 03:30, and once after each deploy): downloads Irish Rail's GTFS
// once, builds yesterday's, today's and tomorrow's departures for every station, and writes one small JSON file
// per station per day to the site bucket (`timetable/<date>/<code>.json`), which CloudFront serves to the app.
// Yesterday is included for trains still running after midnight. An S3 rule deletes files after 3 days.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ALL_STATIONS, irishDate, timetableFiles } from '@dart-times/core';
import { downloadGtfs } from './gtfs';

const s3 = new S3Client({});

export async function handler(): Promise<{ files: number; dates: string[] }> {
  const bucket = process.env.SITE_BUCKET;
  if (!bucket) throw new Error('SITE_BUCKET is not set');
  const now = Date.now();
  const dates = [irishDate(now, -1), irishDate(now), irishDate(now, 1)];
  const gtfs = await downloadGtfs();
  const files = timetableFiles(gtfs, dates, ALL_STATIONS, new Date(now).toISOString());

  // A few uploads at a time: a few hundred small files take a few seconds.
  const entries = [...files];
  for (let i = 0; i < entries.length; i += 25) {
    await Promise.all(
      entries.slice(i, i + 25).map(([key, body]) =>
        s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: 'application/json',
            // Each day has its own path, so files can be cached; an hour lets a same-day rebuild through.
            CacheControl: 'public, max-age=3600',
          }),
        ),
      ),
    );
  }
  console.log(`Wrote ${files.size} timetable files for ${dates.join(', ')}`);
  return { files: files.size, dates };
}
