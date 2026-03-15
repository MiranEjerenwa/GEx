import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  SharedMomentPublishedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import * as communityRepo from '../repositories/community.repository';

const PHOTOS_BUCKET = process.env.PHOTOS_BUCKET || 'egp-shared-moments';
const MAX_CAPTION_LENGTH = 280;

export class CommunityService {
  private s3: S3Client;
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(s3: S3Client, eventBridge: EventBridgeClient, logger: Logger) {
    this.s3 = s3;
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  async getCommunityImpact(): Promise<communityRepo.CommunityImpactMetrics | null> {
    return communityRepo.getCommunityImpact();
  }

  async getUserImpact(userId: string): Promise<communityRepo.UserImpactMetrics | null> {
    return communityRepo.getUserImpact(userId);
  }

  async generateImpactBadge(userId: string): Promise<Record<string, unknown>> {
    const metrics = await communityRepo.getUserImpact(userId);
    return {
      userId,
      experiencesGifted: metrics?.experiences_gifted ?? 0,
      materialGiftsReplaced: metrics?.material_gifts_replaced ?? 0,
      badgeUrl: `/community/impact/user/${userId}/badge.png`,
    };
  }

  async getPublishedFeed(limit: number, cursor?: string): Promise<{ items: communityRepo.SharedMoment[]; nextCursor?: string }> {
    const result = await communityRepo.getPublishedMoments(limit, cursor);
    return { items: result.items, nextCursor: result.lastKey };
  }

  async submitMoment(input: {
    experienceId: string;
    experienceName: string;
    userId: string;
    caption: string;
    consentGiven: boolean;
    isMinor: boolean;
    photoKey?: string;
  }): Promise<communityRepo.SharedMoment> {
    if (!input.consentGiven) {
      throw new CommunityError(ErrorCode.VALIDATION_ERROR, 'Consent is required to share a moment', 400);
    }
    if (input.caption.length > MAX_CAPTION_LENGTH) {
      throw new CommunityError(ErrorCode.VALIDATION_ERROR, `Caption must be ${MAX_CAPTION_LENGTH} characters or less`, 400);
    }

    const status = input.isMinor ? 'pending_guardian_approval' : 'published';

    const moment = await communityRepo.createMoment({
      experience_id: input.experienceId,
      experience_name: input.experienceName,
      user_id: input.userId,
      photo_url: input.photoKey ? `https://${PHOTOS_BUCKET}.s3.amazonaws.com/${input.photoKey}` : undefined,
      caption: input.caption,
      consent_given: input.consentGiven,
      guardian_approved: !input.isMinor,
      is_minor: input.isMinor,
      status,
    });

    if (status === 'published') {
      await this.publishMomentEvent(moment);
    }

    this.logger.info('Shared moment submitted', { momentId: moment.id, status });
    return moment;
  }

  async approveMinorMoment(momentId: string): Promise<communityRepo.SharedMoment> {
    const moment = await communityRepo.approveMoment(momentId);
    if (!moment) {
      throw new CommunityError(ErrorCode.NOT_FOUND, 'Moment not found', 404);
    }
    await this.publishMomentEvent(moment);
    this.logger.info('Minor moment approved and published', { momentId });
    return moment;
  }

  async getPhotoUploadUrl(key: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: PHOTOS_BUCKET,
      Key: key,
      ContentType: 'image/jpeg',
    });
    return getSignedUrl(this.s3, command, { expiresIn: 300 });
  }

  async trackBookingForMetrics(userId: string): Promise<void> {
    await communityRepo.incrementCommunityMetrics();
    await communityRepo.incrementUserMetrics(userId);
  }

  private async publishMomentEvent(moment: communityRepo.SharedMoment): Promise<void> {
    const payload: SharedMomentPublishedEvent = {
      momentId: moment.id,
      experienceId: moment.experience_id,
      experienceName: moment.experience_name,
      publishedAt: new Date().toISOString(),
    };
    await this.eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: EVENT_SOURCE,
        DetailType: EventDetailType.SHARED_MOMENT_PUBLISHED,
        Detail: JSON.stringify(payload),
        EventBusName: EVENT_BUS_NAME,
      }],
    }));
  }
}

export class CommunityError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'CommunityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
