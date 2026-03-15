import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { BookingController } from './controllers/booking.controller';
import { BookingService } from './services/booking.service';

const PORT = parseInt(process.env.PORT ?? '3004', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'booking-service' });
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });
  const bookingService = new BookingService(eventBridge, logger);
  const controller = new BookingController(bookingService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Booking service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start booking service:', err);
  process.exit(1);
});
