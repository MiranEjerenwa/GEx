import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from './base.repository';
import { generateRedemptionCode } from '../utils/redemption-code';
import { GiftCardStatus } from '@experience-gift/shared-types';
import type { PoolClient } from 'pg';

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

type GiftCardRow = {
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
};

function toGiftCard(row: GiftCardRow): GiftCard {
  return {
    id: row.id,
    order_id: row.order_id,
    experience_id: row.experience_id,
    recipient_email: row.recipient_email,
    redemption_code: row.redemption_code,
    status: row.status,
    delivered_at: row.delivered_at,
    redeemed_at: row.redeemed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface CreateGiftCardInput {
  order_id: string;
  experience_id: string;
  recipient_email: string;
}

export async function create(input: CreateGiftCardInput): Promise<GiftCard> {
  const id = uuidv4();
  const redemptionCode = generateRedemptionCode();
  const now = new Date();

  const result = await query<GiftCardRow>(
    `INSERT INTO gift_cards (
      id, order_id, experience_id, recipient_email, redemption_code,
      status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [id, input.order_id, input.experience_id, input.recipient_email, redemptionCode, GiftCardStatus.PURCHASED, now, now],
  );

  return toGiftCard(result.rows[0]);
}

export async function getById(id: string): Promise<GiftCard | null> {
  const result = await query<GiftCardRow>('SELECT * FROM gift_cards WHERE id = $1', [id]);
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

export async function getByRedemptionCode(code: string): Promise<GiftCard | null> {
  const result = await query<GiftCardRow>(
    'SELECT * FROM gift_cards WHERE redemption_code = $1',
    [code],
  );
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

export async function getByOrderId(orderId: string): Promise<GiftCard | null> {
  const result = await query<GiftCardRow>(
    'SELECT * FROM gift_cards WHERE order_id = $1',
    [orderId],
  );
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

/**
 * Acquire a pessimistic lock on a gift card row using SELECT ... FOR UPDATE.
 * Must be called within a transaction (pass the PoolClient).
 */
export async function getByRedemptionCodeForUpdate(
  client: PoolClient,
  code: string,
): Promise<GiftCard | null> {
  const result = await client.query<GiftCardRow>(
    'SELECT * FROM gift_cards WHERE redemption_code = $1 FOR UPDATE',
    [code],
  );
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

/**
 * Transition gift card to 'delivered' status.
 * The DB trigger enforces purchased → delivered only.
 */
export async function markAsDelivered(id: string): Promise<GiftCard | null> {
  const now = new Date();
  const result = await query<GiftCardRow>(
    `UPDATE gift_cards
     SET status = $2, delivered_at = $3, updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, GiftCardStatus.DELIVERED, now, now],
  );
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

/**
 * Transition gift card to 'redeemed' status within a transaction.
 * The DB trigger enforces delivered → redeemed only.
 */
export async function markAsRedeemed(
  client: PoolClient,
  id: string,
): Promise<GiftCard | null> {
  const now = new Date();
  const result = await client.query<GiftCardRow>(
    `UPDATE gift_cards
     SET status = $2, redeemed_at = $3, updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [id, GiftCardStatus.REDEEMED, now, now],
  );
  return result.rows[0] ? toGiftCard(result.rows[0]) : null;
}

/**
 * Atomic redemption: lock → verify → update → return within a single transaction.
 * Returns the updated gift card or throws on invalid state.
 */
export async function redeemWithLock(
  redemptionCode: string,
): Promise<GiftCard> {
  return withTransaction(async (client) => {
    const giftCard = await getByRedemptionCodeForUpdate(client, redemptionCode);
    if (!giftCard) {
      throw new RedemptionError('invalid_code', 'Invalid redemption code');
    }

    if (giftCard.status === GiftCardStatus.REDEEMED) {
      throw new RedemptionError('already_redeemed', 'Gift card has already been redeemed', giftCard);
    }

    if (giftCard.status !== GiftCardStatus.DELIVERED) {
      throw new RedemptionError('not_delivered', 'Gift card has not been delivered yet');
    }

    const redeemed = await markAsRedeemed(client, giftCard.id);
    if (!redeemed) {
      throw new RedemptionError('concurrent_conflict', 'Concurrent redemption conflict');
    }

    return redeemed;
  });
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
