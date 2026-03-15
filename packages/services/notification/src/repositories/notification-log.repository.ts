import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.NOTIFICATION_LOG_TABLE || 'notification_log';

let docClient: DynamoDBDocumentClient | null = null;

export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

export function setDocClient(client: DynamoDBDocumentClient): void {
  docClient = client;
}

export interface NotificationLogEntry {
  id: string;
  recipient_email: string;
  notification_type: string;
  status: string;
  reference_id: string;
  attempt_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export async function logNotification(entry: Omit<NotificationLogEntry, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationLogEntry> {
  const now = new Date().toISOString();
  const item: NotificationLogEntry = {
    ...entry,
    id: uuidv4(),
    created_at: now,
    updated_at: now,
  };

  await getDocClient().send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function getByReferenceId(referenceId: string): Promise<NotificationLogEntry[]> {
  const result = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'reference_id-index',
    KeyConditionExpression: 'reference_id = :rid',
    ExpressionAttributeValues: { ':rid': referenceId },
  }));
  return (result.Items || []) as NotificationLogEntry[];
}

export async function updateStatus(
  id: string,
  status: string,
  lastError?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const item: Partial<NotificationLogEntry> = { id, status, updated_at: now };
  if (lastError) item.last_error = lastError;

  await getDocClient().send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}
