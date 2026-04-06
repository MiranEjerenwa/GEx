import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { FargateService } from '../constructs/fargate-service';
import { EnvironmentConfig } from '../config';

export interface ServicesStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;
  config: EnvironmentConfig;
  purchaserUserPool: cognito.IUserPool;
  partnerUserPool: cognito.IUserPool;
  adminUserPool: cognito.IUserPool;
}

interface ServiceConfig {
  name: string;
  pathPattern: string;
  priority: number;
  healthCheckPath?: string;
  cpu?: number;
  memoryLimitMiB?: number;
  environment?: Record<string, string>;
}

export class ServicesStack extends cdk.Stack {
  public readonly services: Record<string, FargateService> = {};
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly listener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: ServicesStackProps) {
    super(scope, id, props);

    const { vpc, ecsCluster, config } = props;
    const envSuffix = config.envName;

    // Look up Cognito client IDs from the L2 constructs
    const purchaserClients = props.purchaserUserPool.node.findAll()
      .filter((c): c is cognito.UserPoolClient => c instanceof cognito.UserPoolClient);
    const partnerClients = props.partnerUserPool.node.findAll()
      .filter((c): c is cognito.UserPoolClient => c instanceof cognito.UserPoolClient);
    const adminClients = props.adminUserPool.node.findAll()
      .filter((c): c is cognito.UserPoolClient => c instanceof cognito.UserPoolClient);

    const purchaserClientId = purchaserClients[0]?.userPoolClientId ?? '';
    const partnerClientId = partnerClients[0]?.userPoolClientId ?? '';
    const adminClientId = adminClients[0]?.userPoolClientId ?? '';

    // Shared env vars for all services
    const sharedEnv: Record<string, string> = {
      DYNAMO_TABLE_SUFFIX: envSuffix,
      AWS_REGION: cdk.Stack.of(this).region,
    };

    // Auth service needs Cognito pool config
    const authEnv: Record<string, string> = {
      ...sharedEnv,
      PURCHASER_USER_POOL_ID: props.purchaserUserPool.userPoolId,
      PURCHASER_CLIENT_ID: purchaserClientId,
      PARTNER_USER_POOL_ID: props.partnerUserPool.userPoolId,
      PARTNER_CLIENT_ID: partnerClientId,
      ADMIN_USER_POOL_ID: props.adminUserPool.userPoolId,
      ADMIN_CLIENT_ID: adminClientId,
    };

    // Admin service needs DynamoDB table name overrides
    const adminEnv: Record<string, string> = {
      ...sharedEnv,
      ACTION_LOG_TABLE: `experience-gift-admin-action-log-${envSuffix}`,
      PLATFORM_SETTINGS_TABLE: `experience-gift-admin-platform-settings-${envSuffix}`,
    };

    const SERVICE_CONFIGS: ServiceConfig[] = [
      { name: 'catalog',      pathPattern: 'catalog',       priority: 100, healthCheckPath: '/health', environment: sharedEnv },
      { name: 'order',        pathPattern: 'orders',        priority: 200, healthCheckPath: '/orders/health', environment: sharedEnv },
      { name: 'gift-card',    pathPattern: 'gift-cards',    priority: 300, healthCheckPath: '/gift-cards/health', environment: sharedEnv },
      { name: 'booking',      pathPattern: 'bookings',      priority: 400, healthCheckPath: '/bookings/health', environment: sharedEnv },
      { name: 'partner',      pathPattern: 'partners',      priority: 500, healthCheckPath: '/partners/health', environment: sharedEnv },
      { name: 'admin',        pathPattern: 'admin',         priority: 600, healthCheckPath: '/admin/health', environment: adminEnv },
      { name: 'notification', pathPattern: 'notifications', priority: 700, healthCheckPath: '/notifications/health', environment: sharedEnv },
      { name: 'auth',         pathPattern: 'auth',          priority: 800, healthCheckPath: '/auth/health', environment: authEnv },
      { name: 'wishlist',     pathPattern: 'wishlists',     priority: 900, healthCheckPath: '/wishlists/health', environment: sharedEnv },
      { name: 'community',    pathPattern: 'community',     priority: 1000, healthCheckPath: '/community/health', environment: sharedEnv },
      { name: 'payment',      pathPattern: 'payments',      priority: 1100, healthCheckPath: '/payments/health', environment: sharedEnv },
    ];

    // Single shared ALB for all services
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'SharedAlb', {
      loadBalancerName: `egp-alb-${config.envName}`,
      vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // Default action returns 404 for unmatched paths
    this.listener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: '{"error":"Not Found"}',
      }),
    });

    const cloudMapNamespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceDiscovery', {
      name: `experience-gift-${config.envName}.local`,
      vpc,
      description: 'Private DNS namespace for internal service discovery',
    });

    // IAM policies
    const dynamoPolicy = new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/experience-gift-*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/experience-gift-*/index/*`,
      ],
    });

    const cognitoPolicy = new iam.PolicyStatement({
      actions: ['cognito-idp:*'],
      resources: [
        props.purchaserUserPool.userPoolArn,
        props.partnerUserPool.userPoolArn,
        props.adminUserPool.userPoolArn,
      ],
    });

    for (const svcConfig of SERVICE_CONFIGS) {
      const svc = new FargateService(this, `Svc-${svcConfig.name}`, {
        serviceName: svcConfig.name,
        cluster: ecsCluster,
        vpc,
        cloudMapNamespace,
        listener: this.listener,
        pathPattern: svcConfig.pathPattern,
        priority: svcConfig.priority,
        healthCheckPath: svcConfig.healthCheckPath ?? '/health',
        cpu: svcConfig.cpu ?? config.fargateCpu,
        memoryLimitMiB: svcConfig.memoryLimitMiB ?? config.fargateMemoryMiB,
        minTaskCount: config.fargateMinTasks,
        maxTaskCount: config.fargateMaxTasks,
        environment: svcConfig.environment,
      });

      // Grant DynamoDB access to all services
      svc.taskDefinition.taskRole.addToPrincipalPolicy(dynamoPolicy);

      // Grant Cognito access to auth service
      if (svcConfig.name === 'auth') {
        svc.taskDefinition.taskRole.addToPrincipalPolicy(cognitoPolicy);
      }

      this.services[svcConfig.name] = svc;
    }

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'Shared ALB DNS name',
    });
  }
}