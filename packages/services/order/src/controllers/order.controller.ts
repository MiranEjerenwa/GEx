import { Request, Response } from 'express';
import { Logger } from '@experience-gift/shared-types';
import { OrderService, OrderError } from '../services/order.service';
import { v4 as uuidv4 } from 'uuid';

export class OrderController {
  private orderService: OrderService;
  private logger: Logger;

  constructor(orderService: OrderService, logger: Logger) {
    this.orderService = orderService;
    this.logger = logger;
  }

  createOrder = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const order = await this.orderService.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  submitPayment = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      const { partnerId } = req.body;

      if (!partnerId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'partnerId is required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const result = await this.orderService.processPayment(id, { partnerId });
      res.status(200).json(result);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  getOrderStatus = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const referenceNumber = req.query.reference_number as string;
      const purchaserEmail = req.query.purchaser_email as string;

      if (!referenceNumber || !purchaserEmail) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reference_number and purchaser_email query parameters are required',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      const order = await this.orderService.getOrderStatus(referenceNumber, purchaserEmail);
      if (!order) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
            requestId,
            traceId: requestId,
          },
        });
        return;
      }

      res.status(200).json(order);
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  listByPurchaser = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const email = req.query.email as string;
      if (!email) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'email query parameter is required', requestId, traceId: requestId } });
        return;
      }
      const role = req.query.role as string;
      const orders = role === 'recipient'
        ? await this.orderService.listByRecipientEmail(email)
        : await this.orderService.listByPurchaserEmail(email);
      res.status(200).json({ orders });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  resendDeliveryEmail = async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    try {
      const { id } = req.params;
      await this.orderService.requestResend(id);
      res.status(200).json({ message: 'Resend request submitted' });
    } catch (error) {
      this.handleError(res, error, requestId);
    }
  };

  private handleError(res: Response, error: unknown, requestId: string): void {
    if (error instanceof OrderError) {
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
