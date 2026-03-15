import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository } from './base.repository';

export interface Category {
  id: string;
  name: string;
  displayOrder: number;
}

const TABLE_NAME = 'experience-gift-catalog-categories';

export class CategoryRepository extends BaseRepository<Category> {
  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, TABLE_NAME, logger);
  }

  async getById(id: string): Promise<Category | null> {
    this.logger.debug('Getting category by id', { id });
    return this.getItem({ id });
  }

  async create(category: Category): Promise<void> {
    this.logger.info('Creating category', { id: category.id });
    await this.putItem(category);
  }

  async update(category: Category): Promise<void> {
    this.logger.info('Updating category', { id: category.id });
    await this.putItem(category);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting category', { id });
    await this.deleteItem({ id });
  }

  async listAll(): Promise<Category[]> {
    this.logger.debug('Listing all categories');
    const result = await this.scanTable();
    return result.items.sort((a, b) => a.displayOrder - b.displayOrder);
  }
}
