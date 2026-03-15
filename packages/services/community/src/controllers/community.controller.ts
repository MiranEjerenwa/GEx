import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { CommunityService, CommunityError } from '../services/community.service';
import { v4 as uuidv4 } from 'uuid';

export class CommunityController {
  private communityService: CommunityService;
  private logger: Logger;

  constructor(communityService: CommunityService, logger: Logger) {
    this.communityService = communityService;
    this.logger = logger;
  }

  getImpact = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const metrics = await this.communityService.getCommunityImpact();
      res.status(200).json(metrics || { total_families: 0, total_experiences_gifted: 0, estimated_family_hours: 0 });
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getUserImpact = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const metrics = await this.communityService.getUserImpact(req.params.userId);
      res.status(200).json(metrics || { experiences_gifted: 0, material_gifts_replaced: 0 });
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getBadge = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const badge = await this.communityService.generateImpactBadge(req.params.userId);
      res.status(200).json(badge);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getFeed = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const limit = parseInt(req.query.limit as string || '20', 10);
      const cursor = req.query.cursor as string | undefined;
      const feed = await this.communityService.getPublishedFeed(limit, cursor);
      res.status(200).json(feed);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  submitMoment = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const moment = await this.communityService.submitMoment(req.body);
      res.status(201).json(moment);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  approveMoment = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const moment = await this.communityService.approveMinorMoment(req.params.id);
      res.status(200).json(moment);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof CommunityError) {
      res.status(error.statusCode).json({
        error: { code: error.code, message: error.message, requestId, traceId: requestId },
      });
      return;
    }
    this.logger.error('Unexpected error', { error: error instanceof Error ? error.message : String(error), requestId });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, traceId: requestId } });
  }
}
