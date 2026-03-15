import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { PaymentController } from './controllers/payment.controller';
import { PaymentService } from './services/payment.service';
import { StripeService } from './services/stripe.service';
import { seedDefaultRate } from './repositories/commission-rate.repository';

const PORT = parseInt(process.env.PORT ?? '3006', 10);
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
const STRIPE_API_KEY = process.env.STRIPE_API_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'payment-service' });

  // Seed default commission rate
  try {
    await seedDefaultRate();
    logger.info('Default commission rate seeded');
  } catch (error) {
    logger.warn('Failed to seed default commission rate', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Stripe service
  const stripeService = new StripeService(STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, logger);

  // EventBridge client
  const eventBridge = new EventBridgeClient({ region: AWS_REGION });

  // Payment service (business logic)
  const paymentService = new PaymentService(stripeService, eventBridge, logger);

  // Controller
  const controller = new PaymentController(paymentService, stripeService, logger);

  // Express app
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Payment service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start payment service:', err);
  process.exit(1);
});
