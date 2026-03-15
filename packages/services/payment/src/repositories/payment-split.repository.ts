import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';

export interface PaymentSplit {
  id: string;
  order_id: string;
  partner_id: string;
  stripe_payment_intent_id: string;
  stripe_transfer_id: string | null;
  total_amount_cents: number;
  platform_amount_cents: number;
  partner_amount_cents: number;
  commission_rate_percent: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

type PaymentSplitRow = {
  id: string;
  order_id: string;
  partner_id: string;
  stripe_payment_intent_id: string;
  stripe_transfer_id: string | null;
  total_amount_cents: number;
  platform_amount_cents: number;
  partner_amount_cents: number;
  commission_rate_percent: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
};

function toPaymentSplit(row: PaymentSplitRow): PaymentSplit {
  return {
    ...row,
    commission_rate_percent: parseFloat(row.commission_rate_percent),
  };
}

export interface CreatePaymentSplitInput {
  orderId: string;
  partnerId: string;
  stripePaymentIntentId: string;
  totalAmountCents: number;
  platformAmountCents: number;
  partnerAmountCents: number;
  commissionRatePercent: number;
  currency?: string;
}

export async function create(input: CreatePaymentSplitInput): Promise<PaymentSplit> {
  const id = uuidv4();
  const now = new Date();
  const result = await query<PaymentSplitRow>(
    `INSERT INTO payment_splits
       (id, order_id, partner_id, stripe_payment_intent_id, total_amount_cents,
        platform_amount_cents, partner_amount_cents, commission_rate_percent, currency, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
     RETURNING *`,
    [
      id,
      input.orderId,
      input.partnerId,
      input.stripePaymentIntentId,
      input.totalAmountCents,
      input.platformAmountCents,
      input.partnerAmountCents,
      input.commissionRatePercent,
      input.currency ?? 'USD',
      now,
      now,
    ],
  );
  return toPaymentSplit(result.rows[0]);
}

export async function getById(id: string): Promise<PaymentSplit | null> {
  const result = await query<PaymentSplitRow>(
    'SELECT * FROM payment_splits WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toPaymentSplit(result.rows[0]) : null;
}

export async function getByOrderId(orderId: string): Promise<PaymentSplit | null> {
  const result = await query<PaymentSplitRow>(
    'SELECT * FROM payment_splits WHERE order_id = $1',
    [orderId],
  );
  return result.rows[0] ? toPaymentSplit(result.rows[0]) : null;
}

export async function listByPartnerId(
  partnerId: string,
  limit = 50,
  offset = 0,
): Promise<{ items: PaymentSplit[]; total: number }> {
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM payment_splits WHERE partner_id = $1',
    [partnerId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<PaymentSplitRow>(
    'SELECT * FROM payment_splits WHERE partner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [partnerId, limit, offset],
  );
  return { items: result.rows.map(toPaymentSplit), total };
}

export async function updateStatus(
  id: string,
  status: 'pending' | 'completed' | 'failed',
  stripeTransferId?: string,
): Promise<PaymentSplit | null> {
  const now = new Date();
  const result = await query<PaymentSplitRow>(
    `UPDATE payment_splits
     SET status = $2, stripe_transfer_id = COALESCE($3, stripe_transfer_id), updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, status, stripeTransferId ?? null, now],
  );
  return result.rows[0] ? toPaymentSplit(result.rows[0]) : null;
}

export async function deleteById(id: string): Promise<boolean> {
  const result = await query('DELETE FROM payment_splits WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
