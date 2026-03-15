import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';

export interface AgeGroupExperienceMapping {
  ageGroup: string;
  experienceId: string;
  createdAt: string;
}

const TABLE_NAME = 'experience-gift-catalog-age-group-mappings';

export class AgeGroupMappingRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly logger: Logger;

  constructor(docClient: DynamoDBDocumentClient, logger: Logger) {
    this.docClient = docClient;
    this.tableName = TABLE_NAME;
    this.logger = logger;
  }

  async getExperienceIdsForAgeGroup(ageGroup: string): Promise<AgeGroupExperienceMapping[]> {
    this.logger.debug('Getting experience IDs for age group', { ageGroup });
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'ageGroup = :ageGroup',
        ExpressionAttributeValues: { ':ageGroup': ageGroup },
      })
    );
    return (result.Items as AgeGroupExperienceMapping[]) ?? [];
  }

  async getAgeGroupsForExperience(experienceId: string): Promise<AgeGroupExperienceMapping[]> {
    this.logger.debug('Getting age groups for experience', { experienceId });
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'experienceId-ageGroup-index',
        KeyConditionExpression: 'experienceId = :experienceId',
        ExpressionAttributeValues: { ':experienceId': experienceId },
      })
    );
    return (result.Items as AgeGroupExperienceMapping[]) ?? [];
  }

  async addMapping(mapping: AgeGroupExperienceMapping): Promise<void> {
    this.logger.info('Adding age group mapping', {
      ageGroup: mapping.ageGroup,
      experienceId: mapping.experienceId,
    });
    await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item: mapping })
    );
  }

  async removeMapping(ageGroup: string, experienceId: string): Promise<void> {
    this.logger.info('Removing age group mapping', { ageGroup, experienceId });
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { ageGroup, experienceId },
      })
    );
  }
}
