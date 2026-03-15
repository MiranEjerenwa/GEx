import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';

export interface CommissionRate {
  id: string;
  partner_id: string | null;
  rate_percent: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

type CommissionRateRow = {
  id: string;
  partner_id: string | null;
  rate_percent: string; // DECIMAL comes back as string from pg
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
};

function toCommissionRate(row: CommissionRateRow): CommissionRate {
  return {
    id: row.id,
    partner_id: row.partner_id,
    rate_percent: parseFloat(row.rate_percent),
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getDefaultRate(): Promise<CommissionRate | null> {
  const result = await query<CommissionRateRow>(
    'SELECT * FROM commission_rates WHERE is_default = true LIMIT 1',
  );
  return result.rows[0] ? toCommissionRate(result.rows[0]) : null;
}

export async function getByPartnerId(partnerId: string): Promise<CommissionRate | null> {
  const result = await query<CommissionRateRow>(
    'SELECT * FROM commission_rates WHERE partner_id = $1',
    [partnerId],
  );
  return result.rows[0] ? toCommissionRate(result.rows[0]) : null;
}

/**
 * Returns the commission rate for a partner, falling back to the default rate.
 */
export async function getEffectiveRate(partnerId: string): Promise<CommissionRate | null> {
  const partnerRate = await getByPartnerId(partnerId);
  if (partnerRate) return partnerRate;
  return getDefaultRate();
}

export async function getById(id: string): Promise<CommissionRate | null> {
  const result = await query<CommissionRateRow>(
    'SELECT * FROM commission_rates WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toCommissionRate(result.rows[0]) : null;
}

export async function listAll(): Promise<CommissionRate[]> {
  const result = await query<CommissionRateRow>(
    'SELECT * FROM commission_rates ORDER BY is_default DESC, created_at ASC',
  );
  return result.rows.map(toCommissionRate);
}

export async function create(
  ratePercent: number,
  partnerId?: string | null,
  isDefault = false,
): Promise<CommissionRate> {
  const id = uuidv4();
  const now = new Date();
  const result = await query<CommissionRateRow>(
    `INSERT INTO commission_rates (id, partner_id, rate_percent, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, partnerId ?? null, ratePercent, isDefault, now, now],
  );
  return toCommissionRate(result.rows[0]);
}

export async function updateRate(
  partnerId: string,
  ratePercent: number,
): Promise<CommissionRate> {
  const now = new Date();
  // Upsert: update if exists, insert if not
  const result = await query<CommissionRateRow>(
    `INSERT INTO commission_rates (id, partner_id, rate_percent, is_default, created_at, updated_at)
     VALUES ($1, $2, $3, false, $4, $5)
     ON CONFLICT (partner_id) DO UPDATE SET rate_percent = $3, updated_at = $5
     RETURNING *`,
    [uuidv4(), partnerId, ratePercent, now, now],
  );
  return toCommissionRate(result.rows[0]);
}

export async function deleteById(id: string): Promise<boolean> {
  const result = await query('DELETE FROM commission_rates WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Seeds the default commission rate (17.5%) if it doesn't already exist.
 */
export async function seedDefaultRate(): Promise<CommissionRate> {
  const existing = await getDefaultRate();
  if (existing) return existing;
  return create(17.5, null, true);
}
