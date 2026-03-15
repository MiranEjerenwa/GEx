import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';

export interface PartnerStripeAccount {
  id: string;
  partner_id: string;
  stripe_account_id: string;
  status: string;
  payouts_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

interface PartnerStripeAccountRow extends Record<string, unknown> {
  id: string;
  partner_id: string;
  stripe_account_id: string;
  status: string;
  payouts_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function create(
  partnerId: string,
  stripeAccountId: string,
): Promise<PartnerStripeAccount> {
  const id = uuidv4();
  const now = new Date();
  const result = await query<PartnerStripeAccountRow>(
    `INSERT INTO partner_stripe_accounts (id, partner_id, stripe_account_id, status, payouts_enabled, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', false, $4, $5)
     RETURNING *`,
    [id, partnerId, stripeAccountId, now, now],
  );
  return result.rows[0];
}

export async function getById(id: string): Promise<PartnerStripeAccount | null> {
  const result = await query<PartnerStripeAccountRow>(
    'SELECT * FROM partner_stripe_accounts WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getByPartnerId(partnerId: string): Promise<PartnerStripeAccount | null> {
  const result = await query<PartnerStripeAccountRow>(
    'SELECT * FROM partner_stripe_accounts WHERE partner_id = $1',
    [partnerId],
  );
  return result.rows[0] ?? null;
}

export async function getByStripeAccountId(
  stripeAccountId: string,
): Promise<PartnerStripeAccount | null> {
  const result = await query<PartnerStripeAccountRow>(
    'SELECT * FROM partner_stripe_accounts WHERE stripe_account_id = $1',
    [stripeAccountId],
  );
  return result.rows[0] ?? null;
}

export async function updateStatus(
  partnerId: string,
  status: string,
  payoutsEnabled: boolean,
): Promise<PartnerStripeAccount | null> {
  const now = new Date();
  const result = await query<PartnerStripeAccountRow>(
    `UPDATE partner_stripe_accounts
     SET status = $2, payouts_enabled = $3, updated_at = $4
     WHERE partner_id = $1
     RETURNING *`,
    [partnerId, status, payoutsEnabled, now],
  );
  return result.rows[0] ?? null;
}

export async function deleteByPartnerId(partnerId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM partner_stripe_accounts WHERE partner_id = $1',
    [partnerId],
  );
  return (result.rowCount ?? 0) > 0;
}
