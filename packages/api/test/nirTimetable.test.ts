import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readNirFile } from '../src/nirTimetable';
import { NIR_REMIND_DAYS, remindAboutNir } from '../src/timetableJob';

const xml = new Uint8Array(readFileSync(new URL('../../core/test/fixtures/nir-sample.xml', import.meta.url)));

describe('readNirFile', () => {
  it('reads the release as downloaded (a ZIP) or the XML inside it', () => {
    const fromXml = readNirFile(xml);
    const fromZip = readNirFile(zipSync({ 'TXC_24_2026-09-10.xml': xml, 'readme.txt': new Uint8Array([104, 105]) }));
    expect(fromXml.journeys).toHaveLength(2);
    expect(fromZip).toEqual(fromXml);
  });

  it('rejects a ZIP with no timetable in it', () => {
    expect(() => readNirFile(zipSync({ 'readme.txt': new Uint8Array([104, 105]) }))).toThrow(/no \.xml/);
  });
});

describe('remindAboutNir', () => {
  const nir = readNirFile(xml); // valid until 20261213

  it('stays quiet while the timetable has more than the reminder period left', () => {
    return expect(remindAboutNir(nir, '20261127', undefined)).resolves.toBeUndefined();
  });

  it(`reminds within ${NIR_REMIND_DAYS} days of the end, after it, and when there's none`, async () => {
    expect(await remindAboutNir(nir, '20261205', undefined)).toMatch(/runs out on 20261213 \(8 days\)/);
    expect(await remindAboutNir(nir, '20261214', undefined)).toMatch(/ran out/);
    expect(await remindAboutNir(undefined, '20261127', undefined)).toMatch(/no NI Railways timetable/);
  });
});
