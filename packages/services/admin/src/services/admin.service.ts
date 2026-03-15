import { Logger } from '@experience-gift/shared-types';
import * as actionLogRepo from '../repositories/action-log.repository';
import * as settingsRepo from '../repositories/platform-settings.repository';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';
const GIFT_CARD_SERVICE_URL = process.env.GIFT_CARD_SERVICE_URL || 'http://localhost:3003';
const PARTNER_SERVICE_URL = process.env.PARTNER_SERVICE_URL || 'http://localhost:3005';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007';

export class AdminService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async getDashboardMetrics(): Promise<Record<string, unknown>> {
    // Aggregate from other services via HTTP
    const results: Record<string, unknown> = {};
    try {
      const [ordersRes, partnersRes] = await Promise.allSettled([
        fetch(`${ORDER_SERVICE_URL}/orders/status?summary=true`),
        fetch(`${PARTNER_SERVICE_URL}/partners`),
      ]);
      results.ordersAvailable = ordersRes.status === 'fulfilled';
      results.partnersAvailable = partnersRes.status === 'fulfilled';
    } catch {
      this.logger.warn('Some dashboard metrics unavailable');
    }
    return results;
  }

  async searchOrders(query: string): Promise<unknown> {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders/status?reference_number=${encodeURIComponent(query)}&purchaser_email=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    return response.json();
  }

  async getGiftCardDetail(giftCardId: string): Promise<unknown> {
    const [cardRes, auditRes] = await Promise.all([
      fetch(`${GIFT_CARD_SERVICE_URL}/gift-cards/${giftCardId}`),
      fetch(`${GIFT_CARD_SERVICE_URL}/gift-cards/${giftCardId}/audit-log`),
    ]);
    const card = cardRes.ok ? await cardRes.json() : null;
    const auditLog = auditRes.ok ? await auditRes.json() : [];
    return { giftCard: card, auditLog };
  }

  async resendGiftCardEmail(giftCardId: string, adminId: string): Promise<void> {
    await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/resend/${giftCardId}`, { method: 'POST' });
    await actionLogRepo.logAction({
      admin_id: adminId,
      action_type: 'resend_gift_card_email',
      affected_record_id: giftCardId,
      affected_record_type: 'gift_card',
    });
    this.logger.info('Admin resent gift card email', { giftCardId, adminId });
  }

  async updateCommissionRate(partnerId: string, rate: number, adminId: string): Promise<unknown> {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/payments/commissions/${partnerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionRate: rate }),
    });
    const result = response.ok ? await response.json() : null;

    await actionLogRepo.logAction({
      admin_id: adminId,
      action_type: 'update_commission_rate',
      affected_record_id: partnerId,
      affected_record_type: 'partner',
      details: { newRate: rate },
    });
    return result;
  }

  async getSettings(): Promise<settingsRepo.PlatformSettings | null> {
    return settingsRepo.get();
  }

  async updateSettings(settings: Partial<settingsRepo.PlatformSettings>, adminId: string): Promise<settingsRepo.PlatformSettings> {
    const updated = await settingsRepo.update(settings);
    await actionLogRepo.logAction({
      admin_id: adminId,
      action_type: 'update_platform_settings',
      affected_record_id: 'default',
      affected_record_type: 'platform_settings',
    });
    return updated;
  }

  async getActionLog(adminId: string): Promise<actionLogRepo.ActionLogEntry[]> {
    return actionLogRepo.getByAdminId(adminId);
  }
}
