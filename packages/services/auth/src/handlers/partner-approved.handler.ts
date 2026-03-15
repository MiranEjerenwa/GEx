import { CognitoService, TempCredentials } from '../services/cognito.service';
import { PartnerApprovedEvent, Logger } from '@experience-gift/shared-types';

/**
 * Handles the PartnerApproved EventBridge event.
 * Creates Cognito credentials in the Partner user pool for the newly approved partner.
 */
export class PartnerApprovedHandler {
  private cognitoService: CognitoService;
  private logger: Logger;

  constructor(cognitoService: CognitoService, logger: Logger) {
    this.cognitoService = cognitoService;
    this.logger = logger;
  }

  async handle(event: PartnerApprovedEvent): Promise<TempCredentials> {
    this.logger.info('Processing PartnerApproved event', {
      partnerId: event.partnerId,
      email: event.contactEmail,
    });

    try {
      const credentials = await this.cognitoService.createPartnerCredentials(
        event.partnerId,
        event.contactEmail,
      );

      this.logger.info('Partner credentials created successfully', {
        partnerId: event.partnerId,
        email: event.contactEmail,
      });

      return credentials;
    } catch (error) {
      this.logger.error('Failed to create partner credentials', {
        partnerId: event.partnerId,
        email: event.contactEmail,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
