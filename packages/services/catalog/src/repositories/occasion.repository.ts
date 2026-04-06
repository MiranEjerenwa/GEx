import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { BaseRepository, QueryOptions, QueryResult, resolveTableName } from './base.repository';

export interface Occasion {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface OccasionExperienceMapping {
  occasionId: string;
  experienceId: string;
  createdAt: string;
}

const OCCASIONS_TABLE = 'experience-gift-catalog-occasions';
const MAPPINGS_TABLE = 'experience-gift-catalog-occasion-mappings';

export class OccasionRepository extends BaseRepository<Occasion> {
  private readonly mappingsTableName: string;

  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    super(docClient, OCCASIONS_TABLE, logger);
    this.mappingsTableName = resolveTableName(MAPPINGS_TABLE);
  }

  async getById(id: string): Promise<Occasion | null> {
    this.logger.debug('Getting occasion by id', { id });
    return this.getItem({ id });
  }

  async create(occasion: Occasion): Promise<void> {
    this.logger.info('Creating occasion', { id: occasion.id });
    await this.putItem(occasion);
  }

  async update(occasion: Occasion): Promise<void> {
    this.logger.info('Updating occasion', { id: occasion.id });
    await this.putItem(occasion);
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting occasion', { id });
    await this.deleteItem({ id });
  }

  async listAll(): Promise<Occasion[]> {
    this.logger.debug('Listing all occasions');
    const result = await this.scanTable();
    return result.items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async listActive(): Promise<Occasion[]> {
    this.logger.debug('Listing active occasions');
    const result = await this.scanTable({
      filterExpression: 'isActive = :active',
      expressionValues: { ':active': true },
    });
    return result.items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getExperienceIdsForOccasion(occasionId: string, options?: QueryOptions): Promise<QueryResult<OccasionExperienceMapping>> {
    this.logger.debug('Getting experience IDs for occasion', { occasionId });
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.mappingsTableName,
        KeyConditionExpression: 'occasionId = :occasionId',
        ExpressionAttributeValues: { ':occasionId': occasionId },
        ...(options?.limit && { Limit: options.limit }),
        ...(options?.lastEvaluatedKey && { ExclusiveStartKey: options.lastEvaluatedKey }),
      })
    );
    return {
      items: (result.Items as OccasionExperienceMapping[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  async addExperienceMapping(mapping: OccasionExperienceMapping): Promise<void> {
    this.logger.info('Adding occasion-experience mapping', {
      occasionId: mapping.occasionId,
      experienceId: mapping.experienceId,
    });
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await this.docClient.send(
      new PutCommand({ TableName: this.mappingsTableName, Item: mapping })
    );
  }

  async removeExperienceMapping(occasionId: string, experienceId: string): Promise<void> {
    this.logger.info('Removing occasion-experience mapping', { occasionId, experienceId });
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.mappingsTableName,
        Key: { occasionId, experienceId },
      })
    );
  }

  async getOccasionsForExperience(experienceId: string): Promise<OccasionExperienceMapping[]> {
    this.logger.debug('Getting occasions for experience', { experienceId });
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.mappingsTableName,
        IndexName: 'experienceId-occasionId-index',
        KeyConditionExpression: 'experienceId = :experienceId',
        ExpressionAttributeValues: { ':experienceId': experienceId },
      })
    );
    return (result.Items as OccasionExperienceMapping[]) ?? [];
  }
}