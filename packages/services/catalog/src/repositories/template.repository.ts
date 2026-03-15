import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

export interface GiftCardTemplate {
  id: string;
  occasionId: string;
  name: string;
  imageUrl: string;
  suggestedMessage: string;
  isActive: boolean;
  createdAt: string;
}

const TABLE_NAME = 'experience-gift-catalog-templates';

export class TemplateRepository extends BaseRepository<GiftCardTemplate> {
  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, TABLE_NAME, logger);
  }

  async getById(id: string): Promise<GiftCardTemplate | null> {
    this.logger.debug('Getting template by id', { id });
    return this.getItem({ id });
  }

  async create(template: GiftCardTemplate): Promise<void> {
    this.logger.info('Creating template', { id: template.id });
    await this.putItem(template);
  }

  async update(template: GiftCardTemplate): Promise<void> {
    this.logger.info('Updating template', { id: template.id });
    await this.putItem(template);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting template', { id });
    await this.deleteItem({ id });
  }

  async listByOccasion(occasionId: string, options?: QueryOptions): Promise<QueryResult<GiftCardTemplate>> {
    this.logger.debug('Listing templates by occasion', { occasionId });
    return this.queryByIndex(
      'occasionId-createdAt-index',
      'occasionId = :occasionId',
      { ':occasionId': occasionId },
      options
    );
  }

  async listActiveByOccasion(occasionId: string): Promise<GiftCardTemplate[]> {
    this.logger.debug('Listing active templates by occasion', { occasionId });
    const result = await this.queryByIndex(
      'occasionId-createdAt-index',
      'occasionId = :occasionId',
      { ':occasionId': occasionId, ':active': true },
      { filterExpression: 'isActive = :active' }
    );
    return result.items;
  }
}
