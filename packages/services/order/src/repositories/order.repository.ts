import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const SUFFIX = process.env.DYNAMO_TABLE_SUFFIX ? `-${process.env.DYNAMO_TABLE_SUFFIX}` : '';
const TABLE = `experience-gift-orders${SUFFIX}`;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

function generateRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'GEX-';
  for (let i = 0; i < 8; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

export interface Order {
  id: string;
  reference_number: string;
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  personalized_message: string | null;
  experience_id: string;
  occasion: string;
  occasion_template_id: string | null;
  age_group_context: string | null;
  wishlist_item_id: string | null;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  payment_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderInput {
  purchaser_email: string;
  recipient_name: string;
  recipient_email: string;
  personalized_message?: string;
  experience_id: string;
  occasion: string;
  occasion_template_id?: string;
  age_group_context?: string;
  wishlist_item_id?: string;
  amount_cents: number;
  currency?: string;
}

export async function create(input: CreateOrderInput): Promise<Order> {
  const now = new Date().toISOString();
  const order: Record<string, unknown> = {
    id: uuidv4(),
    reference_number: generateRef(),
    purchaser_email: input.purchaser_email,
    recipient_name: input.recipient_name,
    recipient_email: input.recipient_email,
    personalized_message: input.personalized_message ?? null,
    experience_id: input.experience_id,
    occasion: input.occasion,
    occasion_template_id: input.occasion_template_id ?? null,
    age_group_context: input.age_group_context ?? null,
    wishlist_item_id: input.wishlist_item_id ?? null,
    amount_cents: input.amount_cents,
    currency: input.currency ?? 'USD',
    stripe_payment_intent_id: null,
    payment_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLE, Item: order }));
  return order as unknown as Order;
}

export async function getById(id: string): Promise<Order | null> {
  const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id } }));
  return (result.Item as Order) ?? null;
}

export async function getByReferenceNumber(ref: string): Promise<Order | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'reference_number-index',
    KeyConditionExpression: 'reference_number = :ref',
    ExpressionAttributeValues: { ':ref': ref },
  }));
  return (result.Items?.[0] as Order) ?? null;
}

export async function searchByPurchaserEmail(email: string): Promise<Order[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'purchaser_email-created_at-index',
    KeyConditionExpression: 'purchaser_email = :email',
    ExpressionAttributeValues: { ':email': email },
    ScanIndexForward: false,
  }));
  return (result.Items as Order[]) ?? [];
}

export async function searchByRecipientEmail(email: string): Promise<Order[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'recipient_email-created_at-index',
    KeyConditionExpression: 'recipient_email = :email',
    ExpressionAttributeValues: { ':email': email },
    ScanIndexForward: false,
  }));
  return (result.Items as Order[]) ?? [];
}

export async function updatePaymentStatus(
  id: string,
  paymentStatus: string,
  stripePaymentIntentId?: string,
): Promise<Order | null> {
  const now = new Date().toISOString();
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: 'SET payment_status = :ps, stripe_payment_intent_id = :spi, updated_at = :now',
    ExpressionAttributeValues: {
      ':ps': paymentStatus,
      ':spi': stripePaymentIntentId ?? null,
      ':now': now,
    },
    ReturnValues: 'ALL_NEW',
  }));
  return (result.Attributes as Order) ?? null;
}