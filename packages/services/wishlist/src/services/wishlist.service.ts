import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  WishlistItemFulfilledEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import * as wishlistRepo from '../repositories/wishlist.repository';

export class WishlistService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(eventBridge: EventBridgeClient, logger: Logger) {
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  async createWishlist(userId: string, name: string): Promise<wishlistRepo.Wishlist> {
    const wishlist = await wishlistRepo.createWishlist(userId, name);
    this.logger.info('Wishlist created', { wishlistId: wishlist.id });
    return wishlist;
  }

  async getWishlist(id: string): Promise<{ wishlist: wishlistRepo.Wishlist; items: wishlistRepo.WishlistItem[] }> {
    const wishlist = await wishlistRepo.getById(id);
    if (!wishlist) throw new WishlistError(ErrorCode.WISHLIST_NOT_FOUND, 'Wishlist not found', 404);
    const items = await wishlistRepo.getItems(id);
    return { wishlist, items };
  }

  async getWishlistByShareToken(shareToken: string): Promise<{ wishlist: wishlistRepo.Wishlist; items: wishlistRepo.WishlistItem[] }> {
    const wishlist = await wishlistRepo.getByShareToken(shareToken);
    if (!wishlist) throw new WishlistError(ErrorCode.INVALID_SHARE_TOKEN, 'Invalid share link', 404);
    const items = await wishlistRepo.getItems(wishlist.id);
    // Strip fulfillment details for public view
    const publicItems = items.map(({ fulfillment_status, fulfilled_at, ...rest }) => ({
      ...rest,
      fulfillment_status: '' as string,
      fulfilled_at: undefined as string | undefined,
    })) as wishlistRepo.WishlistItem[];
    return { wishlist, items: publicItems };
  }

  async getUserWishlists(userId: string): Promise<wishlistRepo.Wishlist[]> {
    return wishlistRepo.getByUserId(userId);
  }

  async addItem(wishlistId: string, experienceId: string, note?: string): Promise<wishlistRepo.WishlistItem> {
    const wishlist = await wishlistRepo.getById(wishlistId);
    if (!wishlist) throw new WishlistError(ErrorCode.WISHLIST_NOT_FOUND, 'Wishlist not found', 404);
    return wishlistRepo.addItem(wishlistId, experienceId, note);
  }

  async removeItem(itemId: string): Promise<void> {
    await wishlistRepo.removeItem(itemId);
  }

  async fulfillItem(
    wishlistId: string,
    itemId: string,
    wishlistOwnerId: string,
    wishlistOwnerEmail: string,
  ): Promise<void> {
    const item = await wishlistRepo.markItemFulfilled(itemId);
    if (!item) throw new WishlistError(ErrorCode.NOT_FOUND, 'Wishlist item not found', 404);

    const payload: WishlistItemFulfilledEvent = {
      wishlistId,
      wishlistItemId: itemId,
      wishlistOwnerId,
      wishlistOwnerEmail,
    };

    await this.eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: EVENT_SOURCE,
        DetailType: EventDetailType.WISHLIST_ITEM_FULFILLED,
        Detail: JSON.stringify(payload),
        EventBusName: EVENT_BUS_NAME,
      }],
    }));

    this.logger.info('Wishlist item fulfilled', { wishlistId, itemId });
  }
}

export class WishlistError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'WishlistError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
