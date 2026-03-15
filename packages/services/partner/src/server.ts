import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { PartnerController } from './controllers/partner.controller';
import { PartnerService } from './services/partner.service';

const PORT = parseInt(process.env.PORT ?? '3005', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'partner-service' });
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });
  const partnerService = new PartnerService(eventBridge, logger);
  const controller = new PartnerController(partnerService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Partner service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start partner service:', err);
  process.exit(1);
});
