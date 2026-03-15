import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';

export interface QueryOptions {
  limit?: number;
  lastEvaluatedKey?: Record<string, unknown>;
}

export interface QueryResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export abstract class BaseRepository<T> {
  protected readonly docClient: DynamoDBDocumentClient;
  protected readonly tableName: string;
  protected readonly logger: Logger;

  constructor(docClient: DynamoDBDocumentClient, tableName: string, logger: Logger) {
    this.docClient = docClient;
    this.tableName = tableName;
    this.logger = logger;
  }

  protected async getItem(key: Record<string, unknown>): Promise<T | null> {
    const result = await this.docClient.send(
      new GetCommand({ TableName: this.tableName, Key: key })
    );
    return (result.Item as T) ?? null;
  }

  protected async putItem(item: T): Promise<void> {
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: item as Record<string, unknown> })
    );
  }

  protected async deleteItem(key: Record<string, unknown>): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key: key })
    );
  }

  protected async queryByIndex(
    indexName: string,
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options?: QueryOptions & { filterExpression?: string; expressionNames?: Record<string, string> }
  ): Promise<QueryResult<T>> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        ...(options?.filterExpression && { FilterExpression: options.filterExpression }),
        ...(options?.expressionNames && { ExpressionAttributeNames: options.expressionNames }),
        ...(options?.limit && { Limit: options.limit }),
        ...(options?.lastEvaluatedKey && { ExclusiveStartKey: options.lastEvaluatedKey }),
        ScanIndexForward: false,
      })
    );
    return {
      items: (result.Items as T[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  protected async queryByPartitionKey(
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        ...(options?.limit && { Limit: options.limit }),
        ...(options?.lastEvaluatedKey && { ExclusiveStartKey: options.lastEvaluatedKey }),
        ScanIndexForward: false,
      })
    );
    return {
      items: (result.Items as T[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  protected async scanTable(
    options?: QueryOptions & { filterExpression?: string; expressionValues?: Record<string, unknown>; expressionNames?: Record<string, string> }
  ): Promise<QueryResult<T>> {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        ...(options?.filterExpression && { FilterExpression: options.filterExpression }),
        ...(options?.expressionValues && { ExpressionAttributeValues: options.expressionValues }),
        ...(options?.expressionNames && { ExpressionAttributeNames: options.expressionNames }),
        ...(options?.limit && { Limit: options.limit }),
        ...(options?.lastEvaluatedKey && { ExclusiveStartKey: options.lastEvaluatedKey }),
      })
    );
    return {
      items: (result.Items as T[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }
}
