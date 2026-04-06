import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { generateRedemptionCode } from '../utils/redemption-code';
import { GiftCardStatus } from '@experience-gift/shared-types';

const SUFFIX = process.env.DYNAMO_TABLE_SUFFIX ? `-${process.env.DYNAMO_TABLE_SUFFIX}` : '';
const TABLE = `experience-gift-gift-cards${SUFFIX}`;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

export interface GiftCard {
  id: string;
  order_id: string;
  experience_id: string;
  recipient_email: string;
  redemption_code: string;
  status: string;
  delivered_at: Date | null;
  redeemed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGiftCardInput {
  order_id: string;
  experience_id: string;
  recipient_email: string;
}

export async function create(input: CreateGiftCardInput): Promise<GiftCard> {
  const now = new Date().toISOString();
  const item: Record<string, unknown> = {
    id: uuidv4(),
    orderId: input.order_id,
    experienceId: input.experience_id,
    recipientEmail: input.recipient_email,
    redemptionCode: generateRedemptionCode(),
    status: GiftCardStatus.DELIVERED,
    deliveredAt: now,
    redeemedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return mapToGiftCard(item);
}

export async function getById(id: string): Promise<GiftCard | null> {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  return result.Item ? mapToGiftCard(result.Item) : null;
}

export async function getByRedemptionCode(code: string): Promise<GiftCard | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'redemptionCode-index',
    KeyConditionExpression: 'redemptionCode = :code',
    ExpressionAttributeValues: { ':code': code },
  }));
  return result.Items?.[0] ? mapToGiftCard(result.Items[0]) : null;
}

export async function getByOrderId(orderId: string): Promise<GiftCard | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'orderId-index',
    KeyConditionExpression: 'orderId = :oid',
    ExpressionAttributeValues: { ':oid': orderId },
  }));
  return result.Items?.[0] ? mapToGiftCard(result.Items[0]) : null;
}

export async function markAsDelivered(id: string): Promise<GiftCard | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: 'SET #s = :status, deliveredAt = :da, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': GiftCardStatus.DELIVERED, ':da': now, ':now': now },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes ? mapToGiftCard(result.Attributes) : null;
}

export async function redeemWithLock(redemptionCode: string): Promise<GiftCard> {
  const giftCard = await getByRedemptionCode(redemptionCode);
  if (!giftCard) {
    throw new RedemptionError('invalid_code', 'Invalid redemption code');
  }
  if (giftCard.status === GiftCardStatus.REDEEMED) {
    throw new RedemptionError('already_redeemed', 'Gift card has already been redeemed', giftCard);
  }
  if (giftCard.status !== GiftCardStatus.DELIVERED) {
    throw new RedemptionError('not_delivered', 'Gift card has not been delivered yet');
  }

  const now = new Date().toISOString();
  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE,
      Key: { id: giftCard.id },
      UpdateExpression: 'SET #s = :redeemed, redeemedAt = :now, updatedAt = :now',
      ConditionExpression: '#s = :delivered',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':redeemed': GiftCardStatus.REDEEMED, ':delivered': GiftCardStatus.DELIVERED, ':now': now },
      ReturnValues: 'ALL_NEW',
    }));
    return mapToGiftCard(result.Attributes!);
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new RedemptionError('concurrent_conflict', 'Concurrent redemption conflict');
    }
    throw err;
  }
}

function mapToGiftCard(item: Record<string, unknown>): GiftCard {
  return {
    id: item.id as string,
    order_id: (item.orderId as string) ?? (item.order_id as string) ?? '',
    experience_id: (item.experienceId as string) ?? (item.experience_id as string) ?? '',
    recipient_email: (item.recipientEmail as string) ?? (item.recipient_email as string) ?? '',
    redemption_code: (item.redemptionCode as string) ?? (item.redemption_code as string) ?? '',
    status: (item.status as string) ?? '',
    delivered_at: item.deliveredAt ? new Date(item.deliveredAt as string) : null,
    redeemed_at: item.redeemedAt ? new Date(item.redeemedAt as string) : null,
    created_at: new Date((item.createdAt as string) ?? (item.created_at as string) ?? ''),
    updated_at: new Date((item.updatedAt as string) ?? (item.updated_at as string) ?? ''),
  };
}

export class RedemptionError extends Error {
  outcome: string;
  existingGiftCard?: GiftCard;
  constructor(outcome: string, message: string, existingGiftCard?: GiftCard) {
    super(message);
    this.name = 'RedemptionError';
    this.outcome = outcome;
    this.existingGiftCard = existingGiftCard;
  }
}