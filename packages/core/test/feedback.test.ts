import { describe, expect, it } from 'vitest';
import { FEEDBACK_LIMITS, type FeedbackEntry, FeedbackService, InMemoryFeedbackRepository } from '../src/feedback';

function setup(now = Date.parse('2026-11-26T12:00:00Z')) {
  const repo = new InMemoryFeedbackRepository();
  const sent: FeedbackEntry[] = [];
  let clock = now;
  let n = 0;
  const service = new FeedbackService(repo, { notify: async (e) => void sent.push(e) }, {
    now: () => clock,
    newId: () => `id-${++n}`,
    log: () => {},
  });
  return { repo, sent, service, advance: (ms: number) => (clock += ms) };
}

const ok = { message: 'The Howth trains are missing', elapsedMs: 10_000 };

describe('FeedbackService', () => {
  it('saves and emails a valid message, trimmed, with optional details', async () => {
    const { repo, sent, service } = setup();
    const result = await service.submit('dev-1', { ...ok, message: '  Hello there  ', email: ' me@example.ie ', lang: 'ga', appVersion: 'abc123' }, { userAgent: 'Safari' });
    expect(result).toEqual({ ok: true });
    expect(repo.entries).toEqual([
      { id: 'id-1', deviceId: 'dev-1', message: 'Hello there', email: 'me@example.ie', lang: 'ga', appVersion: 'abc123', userAgent: 'Safari', createdAt: '2026-11-26T12:00:00.000Z' },
    ]);
    expect(sent).toHaveLength(1);
  });

  it('rejects messages that are too short or too long, and bad emails', async () => {
    const { repo, service } = setup();
    expect(await service.submit('dev-1', { ...ok, message: 'hi' })).toMatchObject({ ok: false, reason: 'INVALID' });
    expect(await service.submit('dev-1', { ...ok, message: 'x'.repeat(FEEDBACK_LIMITS.maxMessage + 1) })).toMatchObject({ ok: false, reason: 'INVALID' });
    expect(await service.submit('dev-1', { ...ok, email: 'not-an-email' })).toMatchObject({ ok: false, reason: 'INVALID' });
    expect(await service.submit('dev-1', { message: 42 })).toMatchObject({ ok: false, reason: 'INVALID' });
    expect(repo.entries).toEqual([]);
  });

  it('quietly drops bots: a filled honeypot or a form sent too fast', async () => {
    const { repo, sent, service } = setup();
    expect(await service.submit('dev-1', { ...ok, website: 'http://spam' })).toEqual({ ok: true });
    expect(await service.submit('dev-1', { ...ok, elapsedMs: 500 })).toEqual({ ok: true });
    expect(repo.entries).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('limits each device per hour, then lets it send again', async () => {
    const { service, advance } = setup();
    for (let i = 0; i < FEEDBACK_LIMITS.perDeviceHour; i++) expect(await service.submit('dev-1', ok)).toEqual({ ok: true });
    expect(await service.submit('dev-1', ok)).toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
    expect(await service.submit('dev-2', ok)).toEqual({ ok: true });
    advance(61 * 60_000);
    expect(await service.submit('dev-1', ok)).toEqual({ ok: true });
  });

  it('caps messages from everyone per day', async () => {
    const { service } = setup();
    for (let i = 0; i < FEEDBACK_LIMITS.perDay; i++) expect(await service.submit(`dev-${i}`, ok)).toEqual({ ok: true });
    expect(await service.submit('dev-new', ok)).toMatchObject({ ok: false, reason: 'RATE_LIMITED' });
  });

  it('keeps the message when the email notification fails', async () => {
    const repo = new InMemoryFeedbackRepository();
    const service = new FeedbackService(repo, { notify: async () => { throw new Error('SNS down'); } }, { log: () => {} });
    expect(await service.submit('dev-1', ok)).toEqual({ ok: true });
    expect(repo.entries).toHaveLength(1);
  });
});
