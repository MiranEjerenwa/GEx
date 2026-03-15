import { Logger } from '@experience-gift/shared-types';
import { createApp } from './app';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';

const PORT = parseInt(process.env.PORT ?? '3008', 10);

async function main(): Promise<void> {
  const logger = new Logger({ serviceName: 'admin-service' });
  const adminService = new AdminService(logger);
  const controller = new AdminController(adminService, logger);
  const app = createApp({ controller, logger });

  app.listen(PORT, () => {
    logger.info(`Admin service listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start admin service:', err);
  process.exit(1);
});
