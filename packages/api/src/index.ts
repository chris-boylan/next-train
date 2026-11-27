// Lambda entry point (called by CloudFront through a Function URL at /api/*).
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { ALL_STATIONS, describeFeedback, FavouritesService, type FeedbackNotifier, FeedbackService, IrishRailClient } from '@dart-times/core';
import { DynamoFavouritesRepository, DynamoFeedbackRepository } from '@dart-times/core/dynamo';
import { createHandler } from './handler';
import { GtfsTimetable } from './timetable';

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const sns = new SNSClient({});
const topicArn = env('FEEDBACK_TOPIC_ARN');
/** Emails each message to whoever is subscribed to the feedback topic (the owner). */
const emailOwner: FeedbackNotifier = {
  async notify(entry) {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: `Next Train? feedback${entry.email ? ` from ${entry.email}` : ''}`.slice(0, 99),
        Message: describeFeedback(entry),
      }),
    );
  },
};

// Created once per Lambda container, so the client's cache is shared between invocations.
export const handler = createHandler({
  client: new IrishRailClient(),
  favourites: new FavouritesService(new DynamoFavouritesRepository(env('FAVOURITES_TABLE')), ALL_STATIONS),
  feedback: new FeedbackService(new DynamoFeedbackRepository(env('FEEDBACK_TABLE')), emailOwner),
  scheduled: new GtfsTimetable(),
});
