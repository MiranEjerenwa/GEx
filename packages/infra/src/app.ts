#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SharedInfrastructureStack } from './stacks/shared-infrastructure-stack';
import { DatabaseStack } from './stacks/database-stack';
import { ServicesStack } from './stacks/services-stack';
import { EventWiringStack } from './stacks/event-wiring-stack';
import { ApiRoutingStack } from './stacks/api-routing-stack';
import { getConfig } from './config';

const app = new cdk.App();
const config = getConfig(app);

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const prefix = config.envName === 'prod' ? 'ExperienceGift' : `ExperienceGift-${config.envName}`;

const sharedInfra = new SharedInfrastructureStack(app, `${prefix}SharedInfra`, {
  env,
  description: `Experience Gift Platform -- shared infrastructure (${config.envName})`,
  config,
});

new DatabaseStack(app, `${prefix}Database`, {
  env,
  description: `Experience Gift Platform -- database layer (${config.envName})`,
  vpc: sharedInfra.vpc,
  config,
});

const servicesStack = new ServicesStack(app, `${prefix}Services`, {
  env,
  description: `Experience Gift Platform -- ECS Fargate services (${config.envName})`,
  vpc: sharedInfra.vpc,
  ecsCluster: sharedInfra.ecsCluster,
  config,
  purchaserUserPool: sharedInfra.purchaserUserPool,
  partnerUserPool: sharedInfra.partnerUserPool,
  adminUserPool: sharedInfra.adminUserPool,
});

new ApiRoutingStack(app, `${prefix}ApiRouting`, {
  env,
  description: `Experience Gift Platform -- API Gateway routing (${config.envName})`,
  alb: servicesStack.alb,
  albListener: servicesStack.listener,
});

new EventWiringStack(app, `${prefix}EventWiring`, {
  env,
  description: `Experience Gift Platform -- EventBridge event routing (${config.envName})`,
});

app.synth();