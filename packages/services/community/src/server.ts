import { S3Client } from '@aws-sdk/client-s3';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { CommunityController } from './controllers/community.controller';
import { CommunityService } from './services/community.service';

const PORT = parseInt(process.env.PORT ?? '3010', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'community-service' });
  const s3 = new S3Client({ region: AWS_REGION });
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });
  const communityService = new CommunityService(s3, eventBridge, logger);
  const controller = new CommunityController(communityService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Community service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start community service:', err);
  process.exit(1);
});
