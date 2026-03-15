import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';
import { generateReferenceNumber } from '../utils/reference-number';

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

type OrderRow = {
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
};

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference_number: row.reference_number,
    purchaser_email: row.purchaser_email,
    recipient_name: row.recipient_name,
    recipient_email: row.recipient_email,
    personalized_message: row.personalized_message,
    experience_id: row.experience_id,
    occasion: row.occasion,
    occasion_template_id: row.occasion_template_id,
    age_group_context: row.age_group_context,
    wishlist_item_id: row.wishlist_item_id,
    amount_cents: row.amount_cents,
    currency: row.currency,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    payment_status: row.payment_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
  const id = uuidv4();
  const referenceNumber = generateReferenceNumber();
  const now = new Date();

  const result = await query<OrderRow>(
    `INSERT INTO orders (
      id, reference_number, purchaser_email, recipient_name, recipient_email,
      personalized_message, experience_id, occasion, occasion_template_id,
      age_group_context, wishlist_item_id, amount_cents, currency,
      payment_status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      id,
      referenceNumber,
      input.purchaser_email,
      input.recipient_name,
      input.recipient_email,
      input.personalized_message ?? null,
      input.experience_id,
      input.occasion,
      input.occasion_template_id ?? null,
      input.age_group_context ?? null,
      input.wishlist_item_id ?? null,
      input.amount_cents,
      input.currency ?? 'USD',
      'pending',
      now,
      now,
    ],
  );

  return toOrder(result.rows[0]);
}

export async function getById(id: string): Promise<Order | null> {
  const result = await query<OrderRow>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : null;
}

export async function getByReferenceNumber(referenceNumber: string): Promise<Order | null> {
  const result = await query<OrderRow>(
    'SELECT * FROM orders WHERE reference_number = $1',
    [referenceNumber],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : null;
}

export async function searchByPurchaserEmail(email: string): Promise<Order[]> {
  const result = await query<OrderRow>(
    'SELECT * FROM orders WHERE purchaser_email = $1 ORDER BY created_at DESC',
    [email],
  );
  return result.rows.map(toOrder);
}

export async function searchByRecipientEmail(email: string): Promise<Order[]> {
  const result = await query<OrderRow>(
    'SELECT * FROM orders WHERE recipient_email = $1 ORDER BY created_at DESC',
    [email],
  );
  return result.rows.map(toOrder);
}

export async function updatePaymentStatus(
  id: string,
  paymentStatus: string,
  stripePaymentIntentId?: string,
): Promise<Order | null> {
  const now = new Date();
  const result = await query<OrderRow>(
    `UPDATE orders
     SET payment_status = $2,
         stripe_payment_intent_id = COALESCE($3, stripe_payment_intent_id),
         updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, paymentStatus, stripePaymentIntentId ?? null, now],
  );
  return result.rows[0] ? toOrder(result.rows[0]) : null;
}
