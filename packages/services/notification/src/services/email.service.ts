import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '@experience-gift/shared-types';

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@experiencegift.com';

export class EmailService {
  private ses: SESClient;
  private logger: Logger;

  constructor(ses: SESClient, logger: Logger) {
    this.ses = ses;
    this.logger = logger;
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } },
      },
    });

    await this.ses.send(command);
    this.logger.info('Email sent', { to, subject });
  }

  /**
   * Send with retry: up to 3 attempts with exponential backoff (1s, 2s, 4s).
   */
  async sendWithRetry(to: string, subject: string, htmlBody: string): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.sendEmail(to, subject, htmlBody);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error('Email send failed after retries', {
            to,
            subject,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.warn('Email send failed, retrying', { to, attempt, delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
