import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository, QueryResult } from './base.repository';

export interface CuratedCollection {
  id: string;
  occasionId: string;
  name: string;
  description: string;
  experienceIds: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

const TABLE_NAME = 'experience-gift-catalog-collections';

export class CollectionRepository extends BaseRepository<CuratedCollection> {
  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, TABLE_NAME, logger);
  }

  async getById(id: string): Promise<CuratedCollection | null> {
    this.logger.debug('Getting collection by id', { id });
    return this.getItem({ id });
  }

  async create(collection: CuratedCollection): Promise<void> {
    this.logger.info('Creating collection', { id: collection.id });
    await this.putItem(collection);
  }

  async update(collection: CuratedCollection): Promise<void> {
    this.logger.info('Updating collection', { id: collection.id });
    await this.putItem(collection);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting collection', { id });
    await this.deleteItem({ id });
  }

  async listByOccasion(occasionId: string): Promise<QueryResult<CuratedCollection>> {
    this.logger.debug('Listing collections by occasion', { occasionId });
    return this.queryByIndex(
      'occasionId-createdAt-index',
      'occasionId = :occasionId',
      { ':occasionId': occasionId }
    );
  }

  async getActiveForOccasionAndDate(occasionId: string, currentDate: string): Promise<CuratedCollection | null> {
    this.logger.debug('Getting active collection for occasion and date', { occasionId, currentDate });
    const result = await this.queryByIndex(
      'occasionId-createdAt-index',
      'occasionId = :occasionId',
      {
        ':occasionId': occasionId,
        ':active': true,
        ':currentDate': currentDate,
      },
      {
        filterExpression: 'isActive = :active AND startDate <= :currentDate AND endDate >= :currentDate',
      }
    );
    return result.items[0] ?? null;
  }
}
