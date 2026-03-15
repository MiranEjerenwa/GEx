import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { PaymentService, PaymentError } from '../services/payment.service';
import { StripeService } from '../services/stripe.service';
import { v4 as uuidv4 } from 'uuid';

export class PaymentController {
  private paymentService: PaymentService;
  private stripeService: StripeService;
  private logger: Logger;

  constructor(paymentService: PaymentService, stripeService: StripeService, logger: Logger) {
    this.paymentService = paymentService;
    this.stripeService = stripeService;
    this.logger = logger;
  }

  createPaymentIntent = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { orderId, amountCents, currency, partnerId } = req.body;

      if (!orderId || !amountCents || !partnerId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId, amountCents, and partnerId are required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const result = await this.paymentService.createPaymentIntent({
        orderId,
        amountCents,
        currency: currency || 'USD',
        partnerId,
      });

      res.status(201).json(result);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing stripe-signature header',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const event = this.stripeService.constructWebhookEvent(req.body, signature);
      await this.paymentService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error('Webhook processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Webhook signature verification failed',
          requestId,
          traceId: requestId,
        },
      });
    }
  };

  getPartnerPayouts = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { partnerId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await this.paymentService.getPartnerPayouts(partnerId, limit, offset);
      res.status(200).json(result);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getCommissionRates = async (_req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const rates = await this.paymentService.getCommissionRates();
      res.status(200).json({ items: rates });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  updateCommissionRate = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { partnerId } = req.params;
      const { ratePercent } = req.body;

      if (ratePercent === undefined || ratePercent === null) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ratePercent is required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const rate = await this.paymentService.updateCommissionRate(partnerId, ratePercent);
      res.status(200).json(rate);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  createStripeConnectAccount = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { partnerId } = req.params;
      const { email, businessName } = req.body;

      if (!email || !businessName) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email and businessName are required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const account = await this.paymentService.createStripeConnectAccount(partnerId, email, businessName);
      res.status(201).json(account);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof PaymentError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          requestId,
          traceId: requestId,
        },
      });
      return;
    }

    this.logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
        traceId: requestId,
      },
    });
  }
}
