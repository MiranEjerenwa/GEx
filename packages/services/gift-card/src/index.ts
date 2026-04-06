// Gift Card Service - lifecycle management, redemption, audit logging
export { generateRedemptionCode } from './utils/redemption-code';
export { GiftCardService, GiftCardError } from './services/gift-card.service';
export { GiftCardController } from './controllers/gift-card.controller';
export { createGiftCardRouter } from './routes/gift-card.routes';
export { createApp } from './app';