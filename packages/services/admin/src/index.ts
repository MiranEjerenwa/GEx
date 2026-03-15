// Admin Service — platform management, metrics, audit logging
export * from './repositories/dynamo-client';
export * from './repositories/action-log.repository';
export * from './repositories/platform-settings.repository';
export * from './services/admin.service';
export * from './controllers/admin.controller';
export * from './routes/admin.routes';
export { createApp } from './app';
