import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { AdminService } from '../services/admin.service';
import { v4 as uuidv4 } from 'uuid';

export class AdminController {
  private adminService: AdminService;
  private logger: Logger;

  constructor(adminService: AdminService, logger: Logger) {
    this.adminService = adminService;
    this.logger = logger;
  }

  getDashboard = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const metrics = await this.adminService.getDashboardMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  searchOrders = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const q = req.query.q as string || '';
      const results = await this.adminService.searchOrders(q);
      res.status(200).json(results);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getGiftCardDetail = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const detail = await this.adminService.getGiftCardDetail(id);
      res.status(200).json(detail);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  resendGiftCardEmail = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const adminId = req.body.adminId || 'unknown';
      await this.adminService.resendGiftCardEmail(id, adminId);
      res.status(200).json({ message: 'Resend initiated' });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  updateCommissionRate = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const { commissionRate, adminId } = req.body;
      const result = await this.adminService.updateCommissionRate(id, commissionRate, adminId || 'unknown');
      res.status(200).json(result);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getSettings = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const settings = await this.adminService.getSettings();
      res.status(200).json(settings || {});
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const adminId = req.body.adminId || 'unknown';
      const settings = await this.adminService.updateSettings(req.body, adminId);
      res.status(200).json(settings);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, traceId: requestId },
    });
  }
}
