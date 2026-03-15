import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class SharedInfrastructureStack extends cdk.Stack {
  /** VPC spanning 2 AZs with public, private, and isolated (data) subnets */
  public readonly vpc: ec2.IVpc;

  /** ECS Cluster for Fargate services */
  public readonly ecsCluster: ecs.ICluster;

  /** EventBridge custom event bus */
  public readonly eventBus: events.IEventBus;

  /** Dead-letter queue for failed EventBridge deliveries */
  public readonly eventBusDlq: sqs.IQueue;

  /** S3 buckets */
  public readonly frontendAssetsBucket: s3.IBucket;
  public readonly experienceImagesBucket: s3.IBucket;
  public readonly sharedMomentPhotosBucket: s3.IBucket;

  /** CloudFront distribution */
  public readonly distribution: cloudfront.IDistribution;

  /** API Gateway REST API */
  public readonly api: apigateway.RestApi;

  /** Cognito user pools */
  public readonly purchaserUserPool: cognito.IUserPool;
  public readonly partnerUserPool: cognito.IUserPool;
  public readonly adminUserPool: cognito.IUserPool;

  /** ElastiCache Redis */
  public readonly redisSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── VPC ───────────────────────────────────────────────────────────
    this.vpc = this.createVpc();

    // ─── ECS Cluster ───────────────────────────────────────────────────
    this.ecsCluster = this.createEcsCluster();

    // ─── EventBridge ───────────────────────────────────────────────────
    const { eventBus, dlq } = this.createEventBridge();
    this.eventBus = eventBus;
    this.eventBusDlq = dlq;

    // ─── S3 Buckets ────────────────────────────────────────────────────
    const buckets = this.createS3Buckets();
    this.frontendAssetsBucket = buckets.frontendAssets;
    this.experienceImagesBucket = buckets.experienceImages;
    this.sharedMomentPhotosBucket = buckets.sharedMomentPhotos;

    // ─── WAF + CloudFront ──────────────────────────────────────────────
    this.distribution = this.createCloudFrontWithWaf(buckets);

    // ─── API Gateway ───────────────────────────────────────────────────
    this.api = this.createApiGateway();

    // ─── Cognito User Pools ────────────────────────────────────────────
    const pools = this.createCognitoUserPools();
    this.purchaserUserPool = pools.purchaser;
    this.partnerUserPool = pools.partner;
    this.adminUserPool = pools.admin;

    // ─── Secrets Manager ───────────────────────────────────────────────
    this.createSecrets();

    // ─── ElastiCache Redis ─────────────────────────────────────────────
    this.redisSecurityGroup = this.createRedisCluster();

    // ─── Observability ─────────────────────────────────────────────────
    this.createObservability();
  }

  // ─── VPC ─────────────────────────────────────────────────────────────
  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }

  // ─── ECS Cluster ─────────────────────────────────────────────────────
  private createEcsCluster(): ecs.Cluster {
    return new ecs.Cluster(this, 'EcsCluster', {
      vpc: this.vpc as ec2.Vpc,
      clusterName: 'experience-gift-cluster',
      containerInsights: true,
    });
  }

  // ─── EventBridge + DLQ ───────────────────────────────────────────────
  private createEventBridge(): { eventBus: events.EventBus; dlq: sqs.Queue } {
    const dlq = new sqs.Queue(this, 'EventBusDlq', {
      queueName: 'experience-gift-eventbus-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    const eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: 'experience-gift-events',
    });

    // Archive all events for replay / debugging
    eventBus.archive('EventArchive', {
      archiveName: 'experience-gift-event-archive',
      retention: cdk.Duration.days(90),
      eventPattern: { account: [this.account] },
    });

    return { eventBus, dlq };
  }

  // ─── S3 Buckets ──────────────────────────────────────────────────────
  private createS3Buckets() {
    const frontendAssets = new s3.Bucket(this, 'FrontendAssetsBucket', {
      bucketName: `experience-gift-frontend-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
    });

    const experienceImages = new s3.Bucket(this, 'ExperienceImagesBucket', {
      bucketName: `experience-gift-images-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'], // tighten to actual domain in production
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    const sharedMomentPhotos = new s3.Bucket(this, 'SharedMomentPhotosBucket', {
      bucketName: `experience-gift-moments-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
    });

    return { frontendAssets, experienceImages, sharedMomentPhotos };
  }

  // ─── CloudFront + WAF ────────────────────────────────────────────────
  private createCloudFrontWithWaf(buckets: {
    frontendAssets: s3.Bucket;
    experienceImages: s3.Bucket;
    sharedMomentPhotos: s3.Bucket;
  }): cloudfront.Distribution {
    // WAF WebACL — rate limiting + AWS managed rule groups
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'ExperienceGiftWaf',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'RateLimit',
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
        },
        {
          name: 'AWSManagedCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        {
          name: 'AWSManagedSQLiRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
        },
      ],
    });

    // Origin Access Identity for S3 buckets
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');
    buckets.frontendAssets.grantRead(oai);
    buckets.experienceImages.grantRead(oai);
    buckets.sharedMomentPhotos.grantRead(oai);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(buckets.frontendAssets, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/images/*': {
          origin: new origins.S3Origin(buckets.experienceImages, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/moments/*': {
          origin: new origins.S3Origin(buckets.sharedMomentPhotos, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      webAclId: webAcl.attrArn,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    return distribution;
  }

  // ─── API Gateway ─────────────────────────────────────────────────────
  private createApiGateway(): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'experience-gift-api',
      description: 'Experience Gift Platform REST API',
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true, // X-Ray
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Trace-Id',
        ],
      },
    });

    // Resource stubs for per-service routing — actual integrations wired in service stacks
    const serviceRoutes = [
      'catalog',
      'orders',
      'gift-cards',
      'bookings',
      'partners',
      'admin',
      'auth',
      'notifications',
      'wishlists',
      'community',
      'payments',
    ];

    for (const route of serviceRoutes) {
      api.root.addResource(route);
    }

    return api;
  }

  // ─── Cognito User Pools ──────────────────────────────────────────────
  private createCognitoUserPools() {
    // Purchaser / Recipient pool — email + password, no MFA required
    const purchaser = new cognito.UserPool(this, 'PurchaserUserPool', {
      userPoolName: 'experience-gift-purchasers',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    purchaser.addClient('PurchaserAppClient', {
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
    });

    // Partner pool — email + password, optional MFA
    const partner = new cognito.UserPool(this, 'PartnerUserPool', {
      userPoolName: 'experience-gift-partners',
      selfSignUpEnabled: false, // partners created via onboarding approval
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    partner.addClient('PartnerAppClient', {
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
    });

    // Admin pool — email + password, required MFA
    const admin = new cognito.UserPool(this, 'AdminUserPool', {
      userPoolName: 'experience-gift-admins',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    admin.addClient('AdminAppClient', {
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
    });

    return { purchaser, partner, admin };
  }

  // ─── Secrets Manager ─────────────────────────────────────────────────
  private createSecrets(): void {
    new secretsmanager.Secret(this, 'StripeApiKeys', {
      secretName: 'experience-gift/stripe-api-keys',
      description: 'Stripe API keys (publishable + secret) for payment processing',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          publishableKey: 'pk_placeholder',
          secretKey: 'sk_placeholder',
        }),
        generateStringKey: 'rotationToken',
      },
    });

    new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: 'experience-gift/db-credentials',
      description: 'Shared RDS PostgreSQL master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'egp_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });
  }

  // ─── ElastiCache Redis ───────────────────────────────────────────────
  private createRedisCluster(): ec2.SecurityGroup {
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: this.vpc as ec2.Vpc,
      description: 'Security group for ElastiCache Redis cluster',
      allowAllOutbound: false,
    });

    // Allow inbound from private subnets only
    redisSg.addIngressRule(
      ec2.Peer.ipv4((this.vpc as ec2.Vpc).vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis access from within VPC',
    );

    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for catalog cache Redis cluster',
      subnetIds: (this.vpc as ec2.Vpc).selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
      cacheSubnetGroupName: 'experience-gift-redis-subnets',
    });

    new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Catalog caching Redis cluster',
      engine: 'redis',
      cacheNodeType: 'cache.t3.medium',
      numCacheClusters: 2, // primary + 1 replica across AZs
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName!,
      securityGroupIds: [redisSg.securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      port: 6379,
    });

    return redisSg;
  }

  // ─── Observability ───────────────────────────────────────────────────
  private createObservability(): void {
    const serviceNames = [
      'catalog',
      'order',
      'gift-card',
      'booking',
      'partner',
      'admin',
      'notification',
      'auth',
      'wishlist',
      'community',
      'payment',
    ];

    for (const svc of serviceNames) {
      new logs.LogGroup(this, `LogGroup-${svc}`, {
        logGroupName: `/experience-gift/${svc}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }

    // X-Ray tracing is enabled via API Gateway deployOptions.tracingEnabled
    // and will be enabled per-service in the ECS task definitions (sidecar daemon).
    // CloudWatch alarms and dashboards are added per-service in their own stacks.
  }
}
