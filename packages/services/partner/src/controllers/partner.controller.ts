import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { PartnerService, PartnerError } from '../services/partner.service';
import { v4 as uuidv4 } from 'uuid';

export class PartnerController {
  private partnerService: PartnerService;
  private logger: Logger;

  constructor(partnerService: PartnerService, logger: Logger) {
    this.partnerService = partnerService;
    this.logger = logger;
  }

  getDashboard = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const partnerId = req.query.partnerId as string;
      if (!partnerId) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'partnerId query parameter is required', requestId, traceId: requestId },
        });
        return;
      }
      const partner = await this.partnerService.getPartner(partnerId);
      res.status(200).json({ partner });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getAllPartners = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const partners = await this.partnerService.getAllPartners();
      res.status(200).json(partners);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  submitApplication = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const application = await this.partnerService.submitApplication(req.body);
      res.status(201).json(application);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getPendingApplications = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const applications = await this.partnerService.getPendingApplications();
      res.status(200).json(applications);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  approveApplication = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const reviewedBy = req.body.reviewedBy || 'admin';
      const partner = await this.partnerService.approveApplication(id, reviewedBy);
      res.status(200).json(partner);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  rejectApplication = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const { reviewedBy, rejectionReason } = req.body;
      const application = await this.partnerService.rejectApplication(
        id,
        reviewedBy || 'admin',
        rejectionReason,
      );
      res.status(200).json(application);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getStripeOnboardingLink = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const url = await this.partnerService.getStripeConnectOnboardingLink(id);
      res.status(200).json({ url });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  publishExperienceUpdate = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { experienceId, partnerId, action, ageGroups, occasions } = req.body;
      await this.partnerService.publishExperienceUpdate(experienceId, partnerId, action, ageGroups, occasions);
      res.status(200).json({ message: 'Experience update published' });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof PartnerError) {
      res.status(error.statusCode).json({
        error: { code: error.code, message: error.message, requestId, traceId: requestId },
      });
      return;
    }
    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, traceId: requestId },
    });
  }
}
