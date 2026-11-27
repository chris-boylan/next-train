// The daily timetable job (EventBridge, about 03:30, once after each deploy, and whenever a new NIR timetable is
// uploaded): builds yesterday's, today's and tomorrow's departures for every station from Irish Rail's GTFS and
// NI Railways' TransXChange, and writes one small JSON file per station per day to the site bucket
// (`timetable/<date>/<code>.json`), which CloudFront serves to the app. Yesterday is included for trains still
// running after midnight. An S3 rule deletes files after 3 days.
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import {
  ALL_STATIONS,
  buildNirTimetable,
  buildTimetable,
  daysBetween,
  type GtfsFiles,
  irishDate,
  lastServiceDate,
  parseCsv,
  type TimetableSource,
  timetableFiles,
  type Txc,
} from '@dart-times/core';
import { downloadGtfs, GTFS_URL } from './gtfs';
import { loadNirTimetable } from './nirTimetable';

const s3 = new S3Client({});
const sns = new SNSClient({});

/** Remind the owner to upload the next NIR release this many days before the current one runs out. */
export const NIR_REMIND_DAYS = 10;
/** Warn when Irish Rail's GTFS has trains for this few days or fewer (it normally has most of a year). */
export const GTFS_REMIND_DAYS = 14;
/** Warn when the NTA hasn't republished the GTFS for this many days (it normally does so every few days). */
export const GTFS_STALE_DAYS = 14;

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
  await remindAboutGtfs(gtfs, irishDate(now));
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

/**
 * Emails the owner (the alerts topic) when Irish Rail's GTFS is out of date: the NTA has stopped republishing it,
 * or its trains are about to run out. The download still works then, so the job-failed alarm wouldn't notice.
 */
export async function remindAboutGtfs(gtfs: GtfsFiles, today: string, topicArn = process.env.ALERTS_TOPIC_ARN): Promise<string | undefined> {
  const problems: string[] = [];
  const last = lastServiceDate(parseCsv(gtfs.calendar), parseCsv(gtfs.calendarDates));
  const daysLeft = last ? daysBetween(today, last) : undefined;
  if (daysLeft === undefined) problems.push("Irish Rail's GTFS timetable has no trains in it.");
  else if (daysLeft < 0) problems.push(`Irish Rail's GTFS timetable ran out on ${last}, so the app shows no timetabled trains.`);
  else if (daysLeft <= GTFS_REMIND_DAYS) problems.push(`Irish Rail's GTFS timetable runs out on ${last} (${daysLeft} days).`);
  const published = gtfs.feedInfo ? parseCsv(gtfs.feedInfo)[0]?.feed_start_date : undefined;
  if (published && daysBetween(published, today) >= GTFS_STALE_DAYS)
    problems.push(`The NTA hasn't republished Irish Rail's GTFS since ${published} (${daysBetween(published, today)} days).`);
  if (!problems.length) return undefined;
  const message = problems.join(' ');
  const body = `${message}\n\nThe job downloads ${GTFS_URL}. Check that it still points at the current feed (see https://data.gov.ie/dataset/nta-gtfs), and whether the NTA has announced a change.`;
  console.warn(message);
  if (topicArn) await sns.send(new PublishCommand({ TopicArn: topicArn, Subject: 'Next Train?: Irish Rail timetable out of date', Message: body }));
  return message;
}
