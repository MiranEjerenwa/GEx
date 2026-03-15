import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getDocClient } from './dynamo-client';

const MOMENTS_TABLE = process.env.SHARED_MOMENTS_TABLE || 'shared_moments';
const IMPACT_TABLE = process.env.IMPACT_METRICS_TABLE || 'community_impact_metrics';
const BADGES_TABLE = process.env.IMPACT_BADGES_TABLE || 'impact_badges';

export interface SharedMoment {
  id: string;
  experience_id: string;
  experience_name: string;
  user_id: string;
  photo_url?: string;
  caption: string;
  consent_given: boolean;
  guardian_approved: boolean;
  is_minor: boolean;
  status: string;
  created_at: string;
}

export interface CommunityImpactMetrics {
  id: string;
  total_families: number;
  total_experiences_gifted: number;
  estimated_family_hours: number;
  updated_at: string;
}

export interface UserImpactMetrics {
  user_id: string;
  experiences_gifted: number;
  material_gifts_replaced: number;
  updated_at: string;
}

export async function createMoment(input: Omit<SharedMoment, 'id' | 'created_at'>): Promise<SharedMoment> {
  const moment: SharedMoment = { ...input, id: uuidv4(), created_at: new Date().toISOString() };
  await getDocClient().send(new PutCommand({ TableName: MOMENTS_TABLE, Item: moment }));
  return moment;
}

export async function getMomentById(id: string): Promise<SharedMoment | null> {
  const result = await getDocClient().send(new GetCommand({ TableName: MOMENTS_TABLE, Key: { id } }));
  return (result.Item as SharedMoment) || null;
}

export async function approveMoment(id: string): Promise<SharedMoment | null> {
  const result = await getDocClient().send(new UpdateCommand({
    TableName: MOMENTS_TABLE,
    Key: { id },
    UpdateExpression: 'SET #s = :s, guardian_approved = :ga',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'published', ':ga': true },
    ReturnValues: 'ALL_NEW',
  }));
  return (result.Attributes as SharedMoment) || null;
}

export async function getPublishedMoments(limit: number, lastKey?: string): Promise<{ items: SharedMoment[]; lastKey?: string }> {
  const params: Record<string, unknown> = {
    TableName: MOMENTS_TABLE,
    IndexName: 'status-created_at-index',
    KeyConditionExpression: '#s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'published' },
    ScanIndexForward: false,
    Limit: limit,
  };
  if (lastKey) {
    (params as Record<string, unknown>).ExclusiveStartKey = JSON.parse(lastKey);
  }
  const result = await getDocClient().send(new QueryCommand(params as any));
  return {
    items: (result.Items || []) as SharedMoment[],
    lastKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : undefined,
  };
}

export async function getCommunityImpact(): Promise<CommunityImpactMetrics | null> {
  const result = await getDocClient().send(new GetCommand({ TableName: IMPACT_TABLE, Key: { id: 'global' } }));
  return (result.Item as CommunityImpactMetrics) || null;
}

export async function getUserImpact(userId: string): Promise<UserImpactMetrics | null> {
  const result = await getDocClient().send(new GetCommand({ TableName: IMPACT_TABLE, Key: { id: `user-${userId}` } }));
  return (result.Item as UserImpactMetrics) || null;
}

export async function incrementCommunityMetrics(): Promise<void> {
  await getDocClient().send(new UpdateCommand({
    TableName: IMPACT_TABLE,
    Key: { id: 'global' },
    UpdateExpression: 'ADD total_experiences_gifted :one, estimated_family_hours :hours SET updated_at = :now',
    ExpressionAttributeValues: { ':one': 1, ':hours': 2, ':now': new Date().toISOString() },
  }));
}

export async function incrementUserMetrics(userId: string): Promise<void> {
  await getDocClient().send(new UpdateCommand({
    TableName: IMPACT_TABLE,
    Key: { id: `user-${userId}` },
    UpdateExpression: 'ADD experiences_gifted :one, material_gifts_replaced :one SET user_id = :uid, updated_at = :now',
    ExpressionAttributeValues: { ':one': 1, ':uid': userId, ':now': new Date().toISOString() },
  }));
}
