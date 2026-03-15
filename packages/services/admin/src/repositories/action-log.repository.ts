import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getDocClient } from './dynamo-client';

const TABLE_NAME = process.env.ACTION_LOG_TABLE || 'admin_action_log';

export interface ActionLogEntry {
  id: string;
  admin_id: string;
  action_type: string;
  affected_record_id: string;
  affected_record_type: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export async function logAction(entry: Omit<ActionLogEntry, 'id' | 'created_at'>): Promise<ActionLogEntry> {
  const item: ActionLogEntry = {
    ...entry,
    id: uuidv4(),
    created_at: new Date().toISOString(),
  };
  await getDocClient().send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function getByAdminId(adminId: string): Promise<ActionLogEntry[]> {
  const result = await getDocClient().send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'admin_id-index',
    KeyConditionExpression: 'admin_id = :aid',
    ExpressionAttributeValues: { ':aid': adminId },
  }));
  return (result.Items || []) as ActionLogEntry[];
}
