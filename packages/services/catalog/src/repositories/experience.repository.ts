import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository, QueryOptions, QueryResult } from './base.repository';

export interface Experience {
  id: string;
  partnerId: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  location: string;
  imageUrls: string[];
  ageGroups: string[];
  occasions: string[];
  status: string;
  partnerName: string;
  partnerInstructions?: string;
  primaryAgeGroup?: string;
  createdAt: string;
  updatedAt: string;
}

const TABLE_NAME = 'experience-gift-catalog-experiences';

export class ExperienceRepository extends BaseRepository<Experience> {
  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, TABLE_NAME, logger);
  }

  async getById(id: string): Promise<Experience | null> {
    this.logger.debug('Getting experience by id', { id });
    return this.getItem({ id });
  }

  async create(experience: Experience): Promise<void> {
    this.logger.info('Creating experience', { id: experience.id });
    await this.putItem(experience);
  }

  async update(experience: Experience): Promise<void> {
    this.logger.info('Updating experience', { id: experience.id });
    await this.putItem(experience);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting experience', { id });
    await this.deleteItem({ id });
  }

  async listByPartner(partnerId: string, options?: QueryOptions): Promise<QueryResult<Experience>> {
    this.logger.debug('Listing experiences by partner', { partnerId });
    return this.queryByIndex(
      'partnerId-createdAt-index',
      'partnerId = :partnerId',
      { ':partnerId': partnerId },
      options
    );
  }

  async listByCategory(categoryId: string, options?: QueryOptions): Promise<QueryResult<Experience>> {
    this.logger.debug('Listing experiences by category', { categoryId });
    return this.queryByIndex(
      'categoryId-createdAt-index',
      'categoryId = :categoryId',
      { ':categoryId': categoryId },
      options
    );
  }

  async listByPrimaryAgeGroup(ageGroup: string, options?: QueryOptions): Promise<QueryResult<Experience>> {
    this.logger.debug('Listing experiences by primary age group', { ageGroup });
    return this.queryByIndex(
      'primaryAgeGroup-createdAt-index',
      'primaryAgeGroup = :ageGroup',
      { ':ageGroup': ageGroup },
      options
    );
  }

  async listActive(options?: QueryOptions): Promise<QueryResult<Experience>> {
    this.logger.debug('Listing active experiences');
    return this.scanTable({
      filterExpression: '#status = :active',
      expressionValues: { ':active': 'active' },
      expressionNames: { '#status': 'status' },
      ...options,
    });
  }

  async searchByText(searchTerm: string, options?: QueryOptions): Promise<QueryResult<Experience>> {
    this.logger.debug('Searching experiences by text', { searchTerm });
    const lowerSearch = searchTerm.toLowerCase();
    return this.scanTable({
      filterExpression: '(contains(#name, :search) OR contains(description, :search)) AND #status = :active',
      expressionValues: {
        ':search': lowerSearch,
        ':active': 'active',
      },
      expressionNames: { '#name': 'name', '#status': 'status' },
      ...options,
    });
  }
}
