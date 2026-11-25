// DynamoDB storage for favourites, shared by the web API and Alexa Lambdas.
// Kept out of the main entry point so the web bundle never pulls in the AWS SDK.
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { FavouritesRepository } from './favourites';

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
