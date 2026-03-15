import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { CatalogService } from '../services/catalog.service';

export class CatalogController {
  private readonly service: CatalogService;
  private readonly logger: Logger;

  constructor(service: CatalogService, logger: Logger) {
    this.service = service;
    this.logger = logger;
  }

  listExperiences = async (req: Request, res: Response): Promise<void> => {
    try {
      const { category, ageGroup, occasion, search, page, limit } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));

      const result = await this.service.listExperiences({
        category: category as string | undefined,
        ageGroup: ageGroup as string | undefined,
        occasion: occasion as string | undefined,
        search: search as string | undefined,
        page: pageNum,
        limit: limitNum,
      });

      if (result.total === 0) {
        res.status(200).json({
          ...result,
          message: 'No experiences found matching your criteria. Try clearing some filters.',
        });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      this.logger.error('Error listing experiences', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list experiences' },
      });
    }
  };

  getExperience = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const detail = await this.service.getExperience(id);

      if (!detail) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Experience not found' },
        });
        return;
      }

      res.status(200).json(detail);
    } catch (error) {
      this.logger.error('Error getting experience', {
        error: error instanceof Error ? error.message : String(error),
        id: req.params.id,
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get experience' },
      });
    }
  };

  getCategories = async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await this.service.getCategories();
      res.status(200).json(categories);
    } catch (error) {
      this.logger.error('Error listing categories', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list categories' },
      });
    }
  };

  getOccasions = async (_req: Request, res: Response): Promise<void> => {
    try {
      const occasions = await this.service.getOccasions();
      res.status(200).json(occasions);
    } catch (error) {
      this.logger.error('Error listing occasions', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list occasions' },
      });
    }
  };

  getOccasionCollection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const currentDate = req.query.date as string | undefined;
      const collection = await this.service.getOccasionCollection(id, currentDate);

      if (!collection) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'No active collection found for this occasion' },
        });
        return;
      }

      res.status(200).json(collection);
    } catch (error) {
      this.logger.error('Error getting occasion collection', {
        error: error instanceof Error ? error.message : String(error),
        occasionId: req.params.id,
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get occasion collection' },
      });
    }
  };

  getOccasionTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const templates = await this.service.getOccasionTemplates(id);
      res.status(200).json(templates);
    } catch (error) {
      this.logger.error('Error getting occasion templates', {
        error: error instanceof Error ? error.message : String(error),
        occasionId: req.params.id,
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get occasion templates' },
      });
    }
  };
}
