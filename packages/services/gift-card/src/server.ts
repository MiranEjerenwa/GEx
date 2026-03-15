import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { GiftCardController } from './controllers/gift-card.controller';
import { GiftCardService } from './services/gift-card.service';

const PORT = parseInt(process.env.PORT ?? '3003', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'gift-card-service' });
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });
  const giftCardService = new GiftCardService(eventBridge, logger);
  const controller = new GiftCardController(giftCardService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Gift card service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start gift card service:', err);
  process.exit(1);
});
