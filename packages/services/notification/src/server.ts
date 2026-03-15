import { SESClient } from '@aws-sdk/client-ses';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';

const PORT = parseInt(process.env.PORT ?? '3007', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'notification-service' });
  const ses = new SESClient({ region: AWS_REGION });
  const emailService = new EmailService(ses, logger);
  const notificationService = new NotificationService(emailService, logger);
  const controller = new NotificationController(notificationService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Notification service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start notification service:', err);
  process.exit(1);
});
