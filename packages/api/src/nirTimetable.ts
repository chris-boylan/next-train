// NI Railways' timetable file (Translink's TransXChange, from OpenDataNI). OpenDataNI refuses scripted
// downloads and each release has a new file name, so the owner uploads each release to the timetable sources
// bucket (`npm run nir:upload -- <file>`), and the daily job reads it from there.
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { unzipSync } from 'fflate';
import { parseTransXChange, type Txc } from '@dart-times/core';

/** Where the current release lives in the sources bucket: the ZIP as downloaded, or the XML inside it. */
export const NIR_KEYS = ['nir/timetable.zip', 'nir/timetable.xml'] as const;

/** The TransXChange XML from a release: the file itself, or the first .xml in its ZIP. Translink writes windows-1252. */
export function readNirFile(bytes: Uint8Array): Txc {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let xml = bytes;
  if (isZip) {
    const entry = Object.entries(unzipSync(bytes, { filter: (f) => /\.xml$/i.test(f.name) }))[0];
    if (!entry) throw new Error('NIR timetable ZIP has no .xml file');
    xml = entry[1];
  }
  const head = new TextDecoder('ascii').decode(xml.slice(0, 200));
  const encoding = /encoding="([^"]+)"/i.exec(head)?.[1] ?? 'utf-8';
  return parseTransXChange(new TextDecoder(encoding).decode(xml));
}

/** The uploaded release, or undefined when none has been uploaded yet. */
export async function loadNirTimetable(bucket: string, s3 = new S3Client({})): Promise<Txc | undefined> {
  for (const Key of NIR_KEYS) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }));
      return readNirFile(await res.Body!.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey) continue;
      throw err;
    }
  }
  return undefined;
}
