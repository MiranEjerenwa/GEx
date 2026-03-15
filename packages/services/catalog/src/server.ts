import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { RedisCache } from './cache/redis-cache';
import { CatalogController } from './controllers/catalog.controller';
import { CatalogService } from './services/catalog.service';
import {
  ExperienceRepository,
  CategoryRepository,
  OccasionRepository,
  TemplateRepository,
  CollectionRepository,
  TimeSlotRepository,
  AgeGroupMappingRepository,
} from './repositories';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'catalog-service' });

  // DynamoDB client
  const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
  const docClient = DynamoDBDocumentClient.from(dynamoClient);

  // Redis cache
  const cache = new RedisCache({ host: REDIS_HOST, port: REDIS_PORT }, logger);

  // Repositories
  const experienceRepo = new ExperienceRepository(docClient, logger);
  const categoryRepo = new CategoryRepository(docClient, logger);
  const occasionRepo = new OccasionRepository(docClient, logger);
  const templateRepo = new TemplateRepository(docClient, logger);
  const collectionRepo = new CollectionRepository(docClient, logger);
  const timeSlotRepo = new TimeSlotRepository(docClient, logger);
  const ageGroupMappingRepo = new AgeGroupMappingRepository(docClient, logger);

  // Service layer
  const service = new CatalogService({
    experienceRepo,
    categoryRepo,
    occasionRepo,
    templateRepo,
    collectionRepo,
    timeSlotRepo,
    ageGroupMappingRepo,
    cache,
    logger,
  });

  // Controller
  const controller = new CatalogController(service, logger);

  // Express app
  const app = createApp({ controller, logger });

  try {
    await cache.connect();
  } catch {
    logger.warn('Redis connection failed, continuing without cache');
  }

  app.listen(PORT, () => {
    logger.info(`Catalog service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start catalog service:', err);
  process.exit(1);
});
