import { ExperienceUpdatedEvent, EventBridgeEnvelope, Logger } from '@experience-gift/shared-types';
import { RedisCache } from '../cache/redis-cache';

export class ExperienceUpdatedHandler {
  private readonly cache: RedisCache;
  private readonly logger: Logger;

  constructor(cache: RedisCache, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
  }

  async handle(event: EventBridgeEnvelope<ExperienceUpdatedEvent>): Promise<void> {
    const { experienceId, partnerId, action, ageGroups, occasions } = event.detail;

    this.logger.info('Handling ExperienceUpdated event', {
      experienceId,
      partnerId,
      action,
    });

    // Invalidate the specific experience cache
    await this.cache.invalidate(`experience:${experienceId}`);

    // Invalidate partner-specific cache
    await this.cache.invalidatePattern(`partner:${partnerId}:*`);

    // Invalidate category listing caches (experience may have changed category)
    await this.cache.invalidatePattern('experiences:category:*');

    // Invalidate age group caches if age groups are provided
    if (ageGroups && ageGroups.length > 0) {
      for (const ageGroup of ageGroups) {
        await this.cache.invalidatePattern(`experiences:ageGroup:${ageGroup}:*`);
      }
    }
    // Always invalidate the general age group pattern in case groups changed
    await this.cache.invalidatePattern('experiences:ageGroup:*');

    // Invalidate occasion caches if occasions are provided
    if (occasions && occasions.length > 0) {
      for (const occasion of occasions) {
        await this.cache.invalidatePattern(`experiences:occasion:${occasion}:*`);
      }
    }
    await this.cache.invalidatePattern('experiences:occasion:*');

    // Invalidate general listing caches
    await this.cache.invalidatePattern('experiences:list:*');
    await this.cache.invalidatePattern('experiences:search:*');

    // On deactivation, also invalidate collection caches since collections reference experiences
    if (action === 'deactivated') {
      await this.cache.invalidatePattern('collections:*');
    }

    this.logger.info('Cache invalidation complete for ExperienceUpdated', { experienceId, action });
  }
}
