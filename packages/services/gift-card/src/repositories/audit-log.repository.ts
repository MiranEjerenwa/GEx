// Audit log - simplified for DynamoDB
// In production, use a dedicated audit table
export type RedemptionOutcome = 'success' | 'invalid_code' | 'already_redeemed' | 'not_delivered' | 'concurrent_conflict';

export interface AuditLogEntry {
  id: string;
  redemptionCode: string;
  ipAddress: string;
  outcome: RedemptionOutcome;
  giftCardId?: string;
  timestamp: string;
}

const auditLog: AuditLogEntry[] = [];

export async function logRedemptionAttempt(
  redemptionCode: string,
  ipAddress: string,
  outcome: RedemptionOutcome,
  giftCardId?: string,
): Promise<void> {
  auditLog.push({
    id: `audit-${Date.now()}`,
    redemptionCode,
    ipAddress,
    outcome,
    giftCardId,
    timestamp: new Date().toISOString(),
  });
}

export async function getByGiftCardId(giftCardId: string): Promise<AuditLogEntry[]> {
  return auditLog.filter(e => e.giftCardId === giftCardId);
}