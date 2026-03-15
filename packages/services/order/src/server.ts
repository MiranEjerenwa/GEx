import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'order-service' });

  const eventBridge = new EventBridgeClient({ region: AWS_REGION });

  const orderService = new OrderService(eventBridge, logger);

  const controller = new OrderController(orderService, logger);

  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Order service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start order service:', err);
  process.exit(1);
});
