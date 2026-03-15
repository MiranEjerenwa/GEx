import { v4 as uuidv4 } from 'uuid';
import { query } from './base.repository';
import type { PoolClient } from 'pg';

export interface AuditLogEntry {
  id: string;
  redemption_code: string;
  requesting_ip: string;
  outcome: string;
  gift_card_id: string | null;
  created_at: Date;
}

type AuditLogRow = {
  id: string;
  redemption_code: string;
  requesting_ip: string;
  outcome: string;
  gift_card_id: string | null;
  created_at: Date;
};

function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    redemption_code: row.redemption_code,
    requesting_ip: row.requesting_ip,
    outcome: row.outcome,
    gift_card_id: row.gift_card_id,
    created_at: row.created_at,
  };
}

export type RedemptionOutcome =
  | 'success'
  | 'already_redeemed'
  | 'invalid_code'
  | 'concurrent_conflict'
  | 'not_delivered';

export async function logRedemptionAttempt(
  redemptionCode: string,
  requestingIp: string,
  outcome: RedemptionOutcome,
  giftCardId?: string,
  client?: PoolClient,
): Promise<AuditLogEntry> {
  const id = uuidv4();
  const executor = client ?? { query: (text: string, params?: unknown[]) => query(text, params) };

  const result = await executor.query(
    `INSERT INTO redemption_audit_log (id, redemption_code, requesting_ip, outcome, gift_card_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [id, redemptionCode, requestingIp, outcome, giftCardId ?? null],
  );

  const rows = 'rows' in result ? (result as { rows: AuditLogRow[] }).rows : [];
  return toAuditLogEntry(rows[0]);
}

export async function getByGiftCardId(giftCardId: string): Promise<AuditLogEntry[]> {
  const result = await query<AuditLogRow>(
    'SELECT * FROM redemption_audit_log WHERE gift_card_id = $1 ORDER BY created_at DESC',
    [giftCardId],
  );
  return result.rows.map(toAuditLogEntry);
}

export async function getByRedemptionCode(code: string): Promise<AuditLogEntry[]> {
  const result = await query<AuditLogRow>(
    'SELECT * FROM redemption_audit_log WHERE redemption_code = $1 ORDER BY created_at DESC',
    [code],
  );
  return result.rows.map(toAuditLogEntry);
}
