import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  Logger,
  PartnerApprovedEvent,
  PartnerRejectedEvent,
  ExperienceUpdatedEvent,
  EventDetailType,
  EVENT_BUS_NAME,
  EVENT_SOURCE,
  ErrorCode,
} from '@experience-gift/shared-types';
import * as partnerRepo from '../repositories/partner.repository';
import * as onboardingRepo from '../repositories/onboarding.repository';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';

export class PartnerService {
  private eventBridge: EventBridgeClient;
  private logger: Logger;

  constructor(eventBridge: EventBridgeClient, logger: Logger) {
    this.eventBridge = eventBridge;
    this.logger = logger;
  }

  async getPartner(id: string): Promise<partnerRepo.Partner> {
    const partner = await partnerRepo.getById(id);
    if (!partner) {
      throw new PartnerError(ErrorCode.NOT_FOUND, 'Partner not found', 404);
    }
    return partner;
  }

  async getAllPartners(): Promise<partnerRepo.Partner[]> {
    return partnerRepo.getAll();
  }

  async submitApplication(input: onboardingRepo.CreateApplicationInput): Promise<onboardingRepo.OnboardingApplication> {
    this.validateApplicationInput(input);
    const application = await onboardingRepo.create(input);
    this.logger.info('Onboarding application submitted', { applicationId: application.id });
    return application;
  }

  async getPendingApplications(): Promise<onboardingRepo.OnboardingApplication[]> {
    return onboardingRepo.getPending();
  }

  async approveApplication(applicationId: string, reviewedBy: string): Promise<partnerRepo.Partner> {
    const application = await onboardingRepo.approve(applicationId, reviewedBy);
    if (!application) {
      throw new PartnerError(ErrorCode.NOT_FOUND, 'Application not found or already reviewed', 404);
    }

    // Create partner account
    const partner = await partnerRepo.create({
      business_name: application.business_name,
      contact_email: application.contact_email,
      business_description: application.business_description,
    });

    // Publish PartnerApproved event (triggers Auth + Payment + Notification services)
    const payload: PartnerApprovedEvent = {
      partnerId: partner.id,
      businessName: partner.business_name,
      contactEmail: partner.contact_email,
    };
    await this.publishEvent(EventDetailType.PARTNER_APPROVED, payload);

    this.logger.info('Application approved, partner created', {
      applicationId,
      partnerId: partner.id,
    });
    return partner;
  }

  async rejectApplication(
    applicationId: string,
    reviewedBy: string,
    rejectionReason: string,
  ): Promise<onboardingRepo.OnboardingApplication> {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new PartnerError(ErrorCode.VALIDATION_ERROR, 'Rejection reason is required', 400);
    }

    const application = await onboardingRepo.reject(applicationId, reviewedBy, rejectionReason);
    if (!application) {
      throw new PartnerError(ErrorCode.NOT_FOUND, 'Application not found or already reviewed', 404);
    }

    const payload: PartnerRejectedEvent = {
      applicationId: application.id,
      contactEmail: application.contact_email,
      rejectionReason,
    };
    await this.publishEvent(EventDetailType.PARTNER_REJECTED, payload);

    this.logger.info('Application rejected', { applicationId });
    return application;
  }

  async publishExperienceUpdate(
    experienceId: string,
    partnerId: string,
    action: 'created' | 'updated' | 'deactivated',
    ageGroups?: string[],
    occasions?: string[],
  ): Promise<void> {
    const payload: ExperienceUpdatedEvent = {
      experienceId,
      partnerId,
      action,
      ageGroups,
      occasions,
    };
    await this.publishEvent(EventDetailType.EXPERIENCE_UPDATED, payload);
  }

  async getStripeConnectOnboardingLink(partnerId: string): Promise<string> {
    const partner = await this.getPartner(partnerId);
    if (!partner.stripe_connect_account_id) {
      throw new PartnerError(ErrorCode.VALIDATION_ERROR, 'Partner does not have a Stripe Connect account yet', 400);
    }

    // Delegate to Payment Service for Stripe onboarding link
    const response = await fetch(
      `${PAYMENT_SERVICE_URL}/payments/partner/${partnerId}/stripe-connect/onboarding-link`,
    );
    if (!response.ok) {
      throw new PartnerError(ErrorCode.SERVICE_UNAVAILABLE, 'Unable to generate Stripe onboarding link', 502);
    }
    const body = await response.json() as { url: string };
    return body.url;
  }

  private validateApplicationInput(input: onboardingRepo.CreateApplicationInput): void {
    const missing: string[] = [];
    if (!input.business_name) missing.push('business_name');
    if (!input.contact_email) missing.push('contact_email');
    if (!input.business_description) missing.push('business_description');
    if (!input.experience_categories || input.experience_categories.length === 0) {
      missing.push('experience_categories');
    }
    if (missing.length > 0) {
      throw new PartnerError(ErrorCode.VALIDATION_ERROR, `Missing required fields: ${missing.join(', ')}`, 400);
    }
  }

  private async publishEvent(detailType: string, payload: object): Promise<void> {
    const command = new PutEventsCommand({
      Entries: [
        {
          Source: EVENT_SOURCE,
          DetailType: detailType,
          Detail: JSON.stringify(payload),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });
    await this.eventBridge.send(command);
  }
}

export class PartnerError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'PartnerError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
