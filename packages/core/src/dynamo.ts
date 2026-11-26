// DynamoDB storage for favourites (shared by the web API and Alexa Lambdas) and help-page feedback.
// Kept out of the main entry point so the web bundle never pulls in the AWS SDK.
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { FavouritesRepository } from './favourites';
import type { FeedbackEntry, FeedbackRepository } from './feedback';

/** Table layout: partition key `userId`, sort key `stationCode`, plus `addedAt` for ordering. */
export class DynamoFavouritesRepository implements FavouritesRepository {
  constructor(
    private readonly tableName: string,
    private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}

  async list(userId: string): Promise<string[]> {
    const { Items = [] } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
      }),
    );
    return Items.sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt))).map((i) => String(i.stationCode));
  }

  async add(userId: string, stationCode: string): Promise<void> {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { userId, stationCode, addedAt: new Date().toISOString() },
          // Keep the original addedAt if it's already a favourite.
          ConditionExpression: 'attribute_not_exists(stationCode)',
        }),
      );
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
    }
  }

  async remove(userId: string, stationCode: string): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { userId, stationCode } }));
  }
}

/**
 * Feedback table layout: partition key `pk`, sort key `sk`, with `expiresAt` (epoch seconds) as the TTL attribute.
 * - Messages: `pk` = `device#<id>`, `sk` = `<createdAt>#<id>`, kept for a year.
 * - Daily counters: `pk` = `day#<YYYY-MM-DD>`, `sk` = `count`, kept for two days.
 */
export class DynamoFeedbackRepository implements FeedbackRepository {
  constructor(
    private readonly tableName: string,
    private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  ) {}

  async countSince(deviceId: string, since: string): Promise<number> {
    const { Count = 0 } = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :p AND sk > :since',
        ExpressionAttributeValues: { ':p': `device#${deviceId}`, ':since': since },
        Select: 'COUNT',
      }),
    );
    return Count;
  }

  async takeDailySlot(day: string, max: number): Promise<boolean> {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: `day#${day}`, sk: 'count' },
          UpdateExpression: 'ADD used :one SET expiresAt = :exp',
          ConditionExpression: 'attribute_not_exists(used) OR used < :max',
          ExpressionAttributeValues: { ':one': 1, ':max': max, ':exp': epochSeconds(Date.now()) + 2 * 86_400 },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async save(entry: FeedbackEntry): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...entry,
          pk: `device#${entry.deviceId}`,
          sk: `${entry.createdAt}#${entry.id}`,
          expiresAt: epochSeconds(Date.parse(entry.createdAt)) + 365 * 86_400,
        },
      }),
    );
  }
}

const epochSeconds = (ms: number) => Math.floor(ms / 1000);
