import { PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getDocClient } from './dynamo-client';

const WISHLISTS_TABLE = process.env.WISHLISTS_TABLE || 'wishlists';
const WISHLIST_ITEMS_TABLE = process.env.WISHLIST_ITEMS_TABLE || 'wishlist_items';

export interface Wishlist {
  id: string;
  user_id: string;
  name: string;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  experience_id: string;
  note?: string;
  fulfillment_status: string;
  fulfilled_at?: string;
  created_at: string;
}

function generateShareToken(): string {
  return randomBytes(16).toString('hex');
}

export async function createWishlist(userId: string, name: string): Promise<Wishlist> {
  const now = new Date().toISOString();
  const wishlist: Wishlist = {
    id: uuidv4(),
    user_id: userId,
    name,
    share_token: generateShareToken(),
    created_at: now,
    updated_at: now,
  };
  await getDocClient().send(new PutCommand({ TableName: WISHLISTS_TABLE, Item: wishlist }));
  return wishlist;
}

export async function getById(id: string): Promise<Wishlist | null> {
  const result = await getDocClient().send(new GetCommand({ TableName: WISHLISTS_TABLE, Key: { id } }));
  return (result.Item as Wishlist) || null;
}

export async function getByShareToken(shareToken: string): Promise<Wishlist | null> {
  const result = await getDocClient().send(new QueryCommand({
    TableName: WISHLISTS_TABLE,
    IndexName: 'share_token-index',
    KeyConditionExpression: 'share_token = :st',
    ExpressionAttributeValues: { ':st': shareToken },
  }));
  return result.Items?.[0] ? (result.Items[0] as Wishlist) : null;
}

export async function getByUserId(userId: string): Promise<Wishlist[]> {
  const result = await getDocClient().send(new QueryCommand({
    TableName: WISHLISTS_TABLE,
    IndexName: 'user_id-index',
    KeyConditionExpression: 'user_id = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  return (result.Items || []) as Wishlist[];
}

export async function addItem(wishlistId: string, experienceId: string, note?: string): Promise<WishlistItem> {
  const item: WishlistItem = {
    id: uuidv4(),
    wishlist_id: wishlistId,
    experience_id: experienceId,
    note,
    fulfillment_status: 'unfulfilled',
    created_at: new Date().toISOString(),
  };
  await getDocClient().send(new PutCommand({ TableName: WISHLIST_ITEMS_TABLE, Item: item }));
  return item;
}

export async function removeItem(itemId: string): Promise<void> {
  await getDocClient().send(new DeleteCommand({ TableName: WISHLIST_ITEMS_TABLE, Key: { id: itemId } }));
}

export async function getItems(wishlistId: string): Promise<WishlistItem[]> {
  const result = await getDocClient().send(new QueryCommand({
    TableName: WISHLIST_ITEMS_TABLE,
    IndexName: 'wishlist_id-index',
    KeyConditionExpression: 'wishlist_id = :wid',
    ExpressionAttributeValues: { ':wid': wishlistId },
  }));
  return (result.Items || []) as WishlistItem[];
}

export async function markItemFulfilled(itemId: string): Promise<WishlistItem | null> {
  const now = new Date().toISOString();
  const result = await getDocClient().send(new UpdateCommand({
    TableName: WISHLIST_ITEMS_TABLE,
    Key: { id: itemId },
    UpdateExpression: 'SET fulfillment_status = :fs, fulfilled_at = :fa',
    ExpressionAttributeValues: { ':fs': 'fulfilled', ':fa': now },
    ReturnValues: 'ALL_NEW',
  }));
  return (result.Attributes as WishlistItem) || null;
}
