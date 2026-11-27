// Questions and feedback from the web app's help page: validation, spam limits and storage behind interfaces,
// so the API can use DynamoDB + SNS in production and in-memory versions locally and in tests.

export const FEEDBACK_LIMITS = {
  minMessage: 3,
  maxMessage: 1000,
  maxEmail: 254,
  /** Messages one device can send per hour. */
  perDeviceHour: 3,
  /** Messages accepted from everyone per day, so a flood can't fill the inbox. */
  perDay: 50,
  /** Faster than this from opening the form to sending, and it's a bot. */
  minElapsedMs: 3000,
} as const;

/** The JSON body the help page sends. Everything is `unknown` until validated. */
export interface FeedbackInput {
  message?: unknown;
  email?: unknown;
  /** Honeypot: a field hidden from people. Bots fill it in. */
  website?: unknown;
  /** Milliseconds between the form appearing and being sent. */
  elapsedMs?: unknown;
  lang?: unknown;
  appVersion?: unknown;
}

export interface FeedbackEntry {
  id: string;
  deviceId: string;
  message: string;
  email: string;
  lang?: 'en' | 'ga';
  appVersion?: string;
  userAgent?: string;
  createdAt: string;
}

export interface FeedbackRepository {
  /** How many messages this device has sent since `since` (an ISO timestamp). */
  countSince(deviceId: string, since: string): Promise<number>;
  /** Reserves one of the day's slots; false once `max` have been used. */
  takeDailySlot(day: string, max: number): Promise<boolean>;
  save(entry: FeedbackEntry): Promise<void>;
}

export interface FeedbackNotifier {
  notify(entry: FeedbackEntry): Promise<void>;
}

export type FeedbackResult = { ok: true } | { ok: false; reason: 'INVALID' | 'RATE_LIMITED'; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FeedbackServiceOptions {
  now?: () => number;
  newId?: () => string;
  log?: (message: string, err: unknown) => void;
}

export class FeedbackService {
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly log: (message: string, err: unknown) => void;

  constructor(
    private readonly repo: FeedbackRepository,
    private readonly notifier: FeedbackNotifier,
    options: FeedbackServiceOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.log = options.log ?? ((message, err) => console.error(message, err));
  }

  async submit(deviceId: string, input: FeedbackInput, meta: { userAgent?: string } = {}): Promise<FeedbackResult> {
    // Bots: report success so they don't adapt, but keep nothing.
    if (typeof input.website === 'string' && input.website.trim()) return { ok: true };
    if (typeof input.elapsedMs === 'number' && input.elapsedMs < FEEDBACK_LIMITS.minElapsedMs) return { ok: true };

    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (message.length < FEEDBACK_LIMITS.minMessage || message.length > FEEDBACK_LIMITS.maxMessage) {
      return invalid(`Message must be ${FEEDBACK_LIMITS.minMessage}–${FEEDBACK_LIMITS.maxMessage} characters`);
    }
    // An email is required, so every message can be answered.
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    if (!email) return invalid('An email address is required');
    if (email.length > FEEDBACK_LIMITS.maxEmail || !EMAIL.test(email)) return invalid('That email address looks wrong');

    const now = this.now();
    const hourAgo = new Date(now - 60 * 60_000).toISOString();
    if ((await this.repo.countSince(deviceId, hourAgo)) >= FEEDBACK_LIMITS.perDeviceHour) {
      return { ok: false, reason: 'RATE_LIMITED', message: 'Too many messages; please try again later' };
    }
    if (!(await this.repo.takeDailySlot(new Date(now).toISOString().slice(0, 10), FEEDBACK_LIMITS.perDay))) {
      return { ok: false, reason: 'RATE_LIMITED', message: 'Too many messages today; please try again tomorrow' };
    }

    const entry: FeedbackEntry = {
      id: this.newId(),
      deviceId,
      message,
      email,
      ...((input.lang === 'en' || input.lang === 'ga') && { lang: input.lang }),
      ...(typeof input.appVersion === 'string' && { appVersion: input.appVersion.slice(0, 40) }),
      ...(meta.userAgent && { userAgent: meta.userAgent.slice(0, 300) }),
      createdAt: new Date(now).toISOString(),
    };
    await this.repo.save(entry);
    // The message is saved either way; a failed email shouldn't make the sender try again.
    await this.notifier.notify(entry).catch((err: unknown) => this.log('Feedback notification failed', err));
    return { ok: true };
  }
}

const invalid = (message: string): FeedbackResult => ({ ok: false, reason: 'INVALID', message });

/** Plain-text email body for a feedback message. */
export function describeFeedback(entry: FeedbackEntry): string {
  return [
    entry.message,
    '',
    '---',
    `Reply to: ${entry.email}`,
    `Language: ${entry.lang ?? '?'}  ·  App version: ${entry.appVersion ?? '?'}`,
    `Sent: ${entry.createdAt}  ·  Device: ${entry.deviceId}`,
    `Browser: ${entry.userAgent ?? '?'}`,
  ].join('\n');
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  readonly entries: FeedbackEntry[] = [];
  private readonly days = new Map<string, number>();

  async countSince(deviceId: string, since: string): Promise<number> {
    return this.entries.filter((e) => e.deviceId === deviceId && e.createdAt > since).length;
  }

  async takeDailySlot(day: string, max: number): Promise<boolean> {
    const used = this.days.get(day) ?? 0;
    if (used >= max) return false;
    this.days.set(day, used + 1);
    return true;
  }

  async save(entry: FeedbackEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Local development: print the message instead of emailing it. */
export class ConsoleFeedbackNotifier implements FeedbackNotifier {
  async notify(entry: FeedbackEntry): Promise<void> {
    console.log(`\n[feedback]\n${describeFeedback(entry)}\n`);
  }
}
