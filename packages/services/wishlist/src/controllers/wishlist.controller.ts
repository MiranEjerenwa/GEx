import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { WishlistService, WishlistError } from '../services/wishlist.service';
import { v4 as uuidv4 } from 'uuid';

export class WishlistController {
  private wishlistService: WishlistService;
  private logger: Logger;

  constructor(wishlistService: WishlistService, logger: Logger) {
    this.wishlistService = wishlistService;
    this.logger = logger;
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { userId, name } = req.body;
      const wishlist = await this.wishlistService.createWishlist(userId, name);
      res.status(201).json(wishlist);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const result = await this.wishlistService.getWishlist(req.params.id);
      res.status(200).json(result);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getByShareToken = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const result = await this.wishlistService.getWishlistByShareToken(req.params.shareToken);
      res.status(200).json(result);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  getUserWishlists = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const wishlists = await this.wishlistService.getUserWishlists(req.params.userId);
      res.status(200).json(wishlists);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  addItem = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { experienceId, note } = req.body;
      const item = await this.wishlistService.addItem(req.params.id, experienceId, note);
      res.status(201).json(item);
    } catch (error) { this.handleError(res, error, requestId); }
  };

  removeItem = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      await this.wishlistService.removeItem(req.params.itemId);
      res.status(204).send();
    } catch (error) { this.handleError(res, error, requestId); }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof WishlistError) {
      res.status(error.statusCode).json({
        error: { code: error.code, message: error.message, requestId, traceId: requestId },
      });
      return;
    }
    this.logger.error('Unexpected error', { error: error instanceof Error ? error.message : String(error), requestId });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId, traceId: requestId } });
  }
}
