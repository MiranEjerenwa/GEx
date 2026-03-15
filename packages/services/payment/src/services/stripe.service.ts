import Stripe from 'stripe';
import { Logger } from '@experience-gift/shared-types';

export interface CreateConnectAccountResult {
  accountId: string;
  onboardingUrl?: string;
}

export interface CreatePaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  status: string;
}

export interface CreateTransferResult {
  transferId: string;
  amount: number;
  status: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export class StripeService {
  private stripe: Stripe;
  private logger: Logger;
  private webhookSecret: string;

  constructor(apiKey: string, webhookSecret: string, logger: Logger) {
    this.stripe = new Stripe(apiKey, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion });
    this.logger = logger;
    this.webhookSecret = webhookSecret;
  }

  async createConnectAccount(email: string, businessName: string): Promise<CreateConnectAccountResult> {
    this.logger.info('Creating Stripe Connect account', { email, businessName });

    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      business_profile: { name: businessName },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return { accountId: account.id };
  }

  async getOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return link.url;
  }

  async createPaymentIntent(
    amountCents: number,
    currency: string,
    connectedAccountId: string,
    platformFeeCents: number,
    idempotencyKey: string,
  ): Promise<CreatePaymentIntentResult> {
    this.logger.info('Creating payment intent', {
      amountCents,
      currency,
      connectedAccountId,
      platformFeeCents,
      idempotencyKey,
    });

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: connectedAccountId },
      },
      { idempotencyKey },
    );

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret ?? '',
      status: intent.status,
    };
  }

  async createTransfer(
    amountCents: number,
    currency: string,
    connectedAccountId: string,
    paymentIntentId: string,
  ): Promise<CreateTransferResult> {
    this.logger.info('Creating transfer to connected account', {
      amountCents,
      connectedAccountId,
      paymentIntentId,
    });

    const transfer = await this.stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: connectedAccountId,
      source_transaction: paymentIntentId,
    });

    return {
      transferId: transfer.id,
      amount: transfer.amount,
      status: transfer.object,
    };
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    return {
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    };
  }
}
