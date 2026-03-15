import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { WishlistController } from './controllers/wishlist.controller';
import { WishlistService } from './services/wishlist.service';

const PORT = parseInt(process.env.PORT ?? '3009', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'wishlist-service' });
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });
  const wishlistService = new WishlistService(eventBridge, logger);
  const controller = new WishlistController(wishlistService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Wishlist service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start wishlist service:', err);
  process.exit(1);
});
