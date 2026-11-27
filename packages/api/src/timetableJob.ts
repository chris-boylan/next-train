// The daily timetable job (EventBridge, about 03:30, once after each deploy, and whenever a new NIR timetable is
// uploaded): builds yesterday's, today's and tomorrow's departures for every station from Irish Rail's GTFS and
// NI Railways' TransXChange, and writes one small JSON file per station per day to the site bucket
// (`timetable/<date>/<code>.json`), which CloudFront serves to the app. Yesterday is included for trains still
// running after midnight. An S3 rule deletes files after 3 days.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { ALL_STATIONS, buildNirTimetable, buildTimetable, irishDate, type TimetableSource, timetableFiles, type Txc } from '@dart-times/core';
import { downloadGtfs } from './gtfs';
import { loadNirTimetable } from './nirTimetable';

const s3 = new S3Client({});
const sns = new SNSClient({});

/** Remind the owner to upload the next NIR release this many days before the current one runs out. */
export const NIR_REMIND_DAYS = 10;

export async function handler(): Promise<{ files: number; dates: string[]; nirValidUntil?: string }> {
  const bucket = process.env.SITE_BUCKET;
  if (!bucket) throw new Error('SITE_BUCKET is not set');
  const now = Date.now();
  const dates = [irishDate(now, -1), irishDate(now), irishDate(now, 1)];

  const [gtfs, nir] = await Promise.all([downloadGtfs(), loadNir()]);
  const sources: TimetableSource[] = [(date) => buildTimetable(gtfs, date, ALL_STATIONS)];
  if (nir) sources.push((date) => buildNirTimetable(nir, date, ALL_STATIONS));
  const files = timetableFiles(sources, dates, new Date(now).toISOString());

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
  console.log(`Wrote ${files.size} timetable files for ${dates.join(', ')}${nir ? `; NIR timetable valid until ${nir.validUntil}` : '; no NIR timetable'}`);
  await remindAboutNir(nir, irishDate(now));
  return { files: files.size, dates, nirValidUntil: nir?.validUntil };
}

/** The uploaded NIR release. A missing or broken one never stops Irish Rail's timetable being written. */
async function loadNir(): Promise<Txc | undefined> {
  const bucket = process.env.TIMETABLE_SOURCES_BUCKET;
  if (!bucket) return undefined;
  try {
    return await loadNirTimetable(bucket, s3);
  } catch (err) {
    console.error('Could not read the NIR timetable; carrying on without it', err);
    return undefined;
  }
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(4, 6) - 1, +to.slice(6, 8)) - Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8))) / 86_400_000);

/** Emails the owner (the alerts topic) when there's no NIR timetable, or the current one is about to run out. */
export async function remindAboutNir(nir: Txc | undefined, today: string, topicArn = process.env.ALERTS_TOPIC_ARN): Promise<string | undefined> {
  const daysLeft = nir ? daysBetween(today, nir.validUntil) : undefined;
  let message: string | undefined;
  if (!nir) message = 'There is no NI Railways timetable in the timetable sources bucket, so NIR stations show no trains.';
  else if (daysLeft! < 0) message = `The NI Railways timetable ran out on ${nir.validUntil}, so NIR stations show no trains.`;
  else if (daysLeft! <= NIR_REMIND_DAYS) message = `The NI Railways timetable runs out on ${nir.validUntil} (${daysLeft} days).`;
  if (!message) return undefined;
  const body = `${message}\n\nDownload the latest "Translink Northern Ireland Rail Timetable Data" from https://admin.opendatani.gov.uk/dataset/nir20160126v2 and upload it with:\n\n  npm run nir:upload -- <file.zip> --profile next-train\n\nThe timetable is rebuilt a minute after the upload.`;
  console.warn(message);
  if (topicArn) await sns.send(new PublishCommand({ TopicArn: topicArn, Subject: 'Next Train?: NI Railways timetable', Message: body }));
  return message;
}
