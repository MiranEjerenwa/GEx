#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SharedInfrastructureStack } from './stacks/shared-infrastructure-stack';
import { DatabaseStack } from './stacks/database-stack';
import { ServicesStack } from './stacks/services-stack';
import { EventWiringStack } from './stacks/event-wiring-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const sharedInfra = new SharedInfrastructureStack(app, 'ExperienceGiftSharedInfra', {
  env,
  description: 'Experience Gift Platform — shared infrastructure (VPC, ECS, EventBridge, S3, CloudFront, API GW, Cognito, Secrets, Redis, Observability)',
});

new DatabaseStack(app, 'ExperienceGiftDatabase', {
  env,
  description: 'Experience Gift Platform — database layer (RDS PostgreSQL Multi-AZ, DynamoDB tables with GSIs)',
  vpc: sharedInfra.vpc,
});

new ServicesStack(app, 'ExperienceGiftServices', {
  env,
  description: 'Experience Gift Platform — ECS Fargate services (11 microservices with ALBs, auto-scaling, service discovery)',
  vpc: sharedInfra.vpc,
  ecsCluster: sharedInfra.ecsCluster,
  api: sharedInfra.api,
});

new EventWiringStack(app, 'ExperienceGiftEventWiring', {
  env,
  description: 'Experience Gift Platform — EventBridge event routing rules and per-service SQS queues with DLQs',
  eventBus: sharedInfra.eventBus,
  dlq: sharedInfra.eventBusDlq,
});

app.synth();
