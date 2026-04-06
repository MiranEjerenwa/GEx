import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface EventWiringStackProps extends cdk.StackProps {}

interface EventRoute {
  detailType: string;
  consumers: string[];
}

const EVENT_ROUTES: EventRoute[] = [
  { detailType: 'OrderCompleted', consumers: ['gift-card', 'payment'] },
  { detailType: 'GiftCardCreated', consumers: ['notification'] },
  { detailType: 'GiftCardDelivered', consumers: ['notification'] },
  { detailType: 'GiftCardRedeemed', consumers: ['booking', 'notification'] },
  { detailType: 'BookingConfirmed', consumers: ['notification', 'partner', 'community'] },
  { detailType: 'BookingDatePassed', consumers: ['notification'] },
  { detailType: 'PartnerApproved', consumers: ['notification', 'auth', 'payment'] },
  { detailType: 'PartnerRejected', consumers: ['notification'] },
  { detailType: 'ExperienceUpdated', consumers: ['catalog'] },
  { detailType: 'WishlistItemFulfilled', consumers: ['notification'] },
  { detailType: 'SharedMomentPublished', consumers: ['community'] },
  { detailType: 'PaymentSplit', consumers: ['wishlist'] },
];

const EVENT_SOURCE = 'experience-gift-platform';

export class EventWiringStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly queues: Record<string, sqs.Queue> = {};

  constructor(scope: Construct, id: string, props?: EventWiringStackProps) {
    super(scope, id, props);

    // Create EventBridge bus and DLQ in this stack to avoid cross-stack cycles
    const dlq = new sqs.Queue(this, 'EventBusDlq', {
      queueName: 'experience-gift-eventbus-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: 'experience-gift-events',
    });

    this.eventBus.archive('EventArchive', {
      archiveName: 'experience-gift-event-archive',
      retention: cdk.Duration.days(90),
      eventPattern: { account: [this.account] },
    });

    // Collect unique consumer names
    const consumerNames = new Set<string>();
    for (const route of EVENT_ROUTES) {
      for (const consumer of route.consumers) {
        consumerNames.add(consumer);
      }
    }

    // Create a dedicated SQS queue per consumer service
    const consumerQueues: Record<string, sqs.Queue> = {};
    for (const consumer of consumerNames) {
      const consumerDlq = new sqs.Queue(this, `${consumer}-dlq`, {
        queueName: `egp-${consumer}-events-dlq`,
        retentionPeriod: cdk.Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
      });

      const queue = new sqs.Queue(this, `${consumer}-queue`, {
        queueName: `egp-${consumer}-events`,
        visibilityTimeout: cdk.Duration.seconds(60),
        retentionPeriod: cdk.Duration.days(7),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
        deadLetterQueue: {
          queue: consumerDlq,
          maxReceiveCount: 3,
        },
      });

      consumerQueues[consumer] = queue;
      this.queues[consumer] = queue;
    }

    // Create EventBridge rules
    for (const route of EVENT_ROUTES) {
      for (const consumer of route.consumers) {
        const ruleId = `${route.detailType}-to-${consumer}`;

        new events.Rule(this, ruleId, {
          eventBus: this.eventBus,
          ruleName: `egp-${ruleId}`,
          description: `Route ${route.detailType} events to ${consumer} service`,
          eventPattern: {
            source: [EVENT_SOURCE],
            detailType: [route.detailType],
          },
          targets: [
            new targets.SqsQueue(consumerQueues[consumer], {
              deadLetterQueue: dlq,
              retryAttempts: 2,
            }),
          ],
        });
      }
    }

    // Outputs
    for (const [consumer, queue] of Object.entries(consumerQueues)) {
      new cdk.CfnOutput(this, `${consumer}-queue-url`, {
        value: queue.queueUrl,
        description: `SQS queue URL for ${consumer} service events`,
        exportName: `egp-${consumer}-queue-url`,
      });
    }
  }
}