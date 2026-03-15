import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository, QueryResult } from './base.repository';

export interface TimeSlot {
  experienceId: string;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

const TABLE_NAME = 'experience-gift-catalog-time-slots';

export class TimeSlotRepository extends BaseRepository<TimeSlot> {
  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, TABLE_NAME, logger);
  }

  async getByKey(experienceId: string, slotId: string): Promise<TimeSlot | null> {
    this.logger.debug('Getting time slot', { experienceId, slotId });
    return this.getItem({ experienceId, slotId });
  }

  async create(timeSlot: TimeSlot): Promise<void> {
    this.logger.info('Creating time slot', { experienceId: timeSlot.experienceId, slotId: timeSlot.slotId });
    await this.putItem(timeSlot);
  }

  async update(timeSlot: TimeSlot): Promise<void> {
    this.logger.info('Updating time slot', { experienceId: timeSlot.experienceId, slotId: timeSlot.slotId });
    await this.putItem(timeSlot);
  }

  async delete(experienceId: string, slotId: string): Promise<void> {
    this.logger.info('Deleting time slot', { experienceId, slotId });
    await this.deleteItem({ experienceId, slotId });
  }

  async listByExperience(experienceId: string): Promise<QueryResult<TimeSlot>> {
    this.logger.debug('Listing time slots for experience', { experienceId });
    return this.queryByPartitionKey(
      'experienceId = :experienceId',
      { ':experienceId': experienceId }
    );
  }

  async listAvailableByExperience(experienceId: string): Promise<TimeSlot[]> {
    this.logger.debug('Listing available time slots for experience', { experienceId });
    const result = await this.listByExperience(experienceId);
    return result.items.filter((slot) => slot.bookedCount < slot.capacity);
  }
}
