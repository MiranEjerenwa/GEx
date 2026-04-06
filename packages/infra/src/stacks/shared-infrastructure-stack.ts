import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dax from 'aws-cdk-lib/aws-dax';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config';

export interface SharedInfrastructureStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class SharedInfrastructureStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly ecsCluster: ecs.ICluster;
  public readonly frontendAssetsBucket: s3.IBucket;
  public readonly experienceImagesBucket: s3.IBucket;
  public readonly sharedMomentPhotosBucket: s3.IBucket;
  public readonly distribution: cloudfront.IDistribution;
  public readonly purchaserUserPool: cognito.IUserPool;
  public readonly partnerUserPool: cognito.IUserPool;
  public readonly adminUserPool: cognito.IUserPool;
  public readonly daxClusterEndpoint: string;
  public readonly ecrRepositories: Record<string, ecr.IRepository>;

  private readonly config: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: SharedInfrastructureStackProps) {
    super(scope, id, props);
    this.config = props.config;

    this.vpc = this.createVpc();
    this.createVpcEndpoints();
    this.ecsCluster = this.createEcsCluster();

    const buckets = this.createS3Buckets();
    this.frontendAssetsBucket = buckets.frontendAssets;
    this.experienceImagesBucket = buckets.experienceImages;
    this.sharedMomentPhotosBucket = buckets.sharedMomentPhotos;

    this.distribution = this.createCloudFront(buckets);

    const pools = this.createCognitoUserPools();
    this.purchaserUserPool = pools.purchaser;
    this.partnerUserPool = pools.partner;
    this.adminUserPool = pools.admin;

    this.createSecrets();
    this.daxClusterEndpoint = this.createDaxCluster();
    this.createObservability();
    this.ecrRepositories = this.createEcrRepositories();
  }

  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'Vpc', {
      maxAzs: this.config.maxAzs,
      natGateways: 0,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });
  }

  private createVpcEndpoints(): void {
    const vpc = this.vpc as ec2.Vpc;

    // Free gateway endpoints
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Interface endpoints for services that Fargate tasks need
    const interfaceEndpoints: Array<{ id: string; service: ec2.InterfaceVpcEndpointAwsService }> = [
      { id: 'EcrApi', service: ec2.InterfaceVpcEndpointAwsService.ECR },
      { id: 'EcrDocker', service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER },
      { id: 'CwLogs', service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS },
      { id: 'Secrets', service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER },
      { id: 'Sts', service: ec2.InterfaceVpcEndpointAwsService.STS },
      { id: 'Sqs', service: ec2.InterfaceVpcEndpointAwsService.SQS },
      { id: 'Eb', service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE },

    ];

    for (const ep of interfaceEndpoints) {
      vpc.addInterfaceEndpoint(ep.id, {
        service: ep.service,
        privateDnsEnabled: true,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
    }

    // Cognito endpoint only available in us-east-1b/c/d; pick the b subnet
    vpc.addInterfaceEndpoint('Cognito', {
      service: new ec2.InterfaceVpcEndpointAwsService('cognito-idp'),
      privateDnsEnabled: true,
      subnets: { availabilityZones: ['us-east-1b'] },
    });
  }

  private createEcsCluster(): ecs.Cluster {
    return new ecs.Cluster(this, 'EcsCluster', {
      vpc: this.vpc as ec2.Vpc,
      clusterName: `egp-cluster-${this.config.envName}`,
      containerInsights: this.config.containerInsights,
    });
  }

  private createS3Buckets() {
    const suffix = `${this.account}-${this.region}`;
    const envPrefix = this.config.envName === 'prod' ? '' : `${this.config.envName}-`;

    const frontendAssets = new s3.Bucket(this, 'FrontendAssetsBucket', {
      bucketName: `${envPrefix}egp-frontend-${suffix}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: this.config.removalPolicy,
      versioned: this.config.s3Versioned,
    });

    const experienceImages = new s3.Bucket(this, 'ExperienceImagesBucket', {
      bucketName: `${envPrefix}egp-images-${suffix}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: this.config.removalPolicy,
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: ['*'], allowedHeaders: ['*'], maxAge: 3600 }],
    });

    const sharedMomentPhotos = new s3.Bucket(this, 'SharedMomentPhotosBucket', {
      bucketName: `${envPrefix}egp-moments-${suffix}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: this.config.removalPolicy,
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: ['*'], allowedHeaders: ['*'], maxAge: 3600 }],
    });

    return { frontendAssets, experienceImages, sharedMomentPhotos };
  }

  private createCloudFront(buckets: {
    frontendAssets: s3.Bucket;
    experienceImages: s3.Bucket;
    sharedMomentPhotos: s3.Bucket;
  }): cloudfront.Distribution {
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');
    buckets.frontendAssets.grantRead(oai);
    buckets.experienceImages.grantRead(oai);
    buckets.sharedMomentPhotos.grantRead(oai);

    const distProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: new origins.S3Origin(buckets.frontendAssets, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/images/*': {
          origin: new origins.S3Origin(buckets.experienceImages, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/moments/*': {
          origin: new origins.S3Origin(buckets.sharedMomentPhotos, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    };

    // WAF only for prod  requires us-east-1 and adds cost
    if (this.config.envName === 'prod') {
      const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
        defaultAction: { allow: {} },
        scope: 'CLOUDFRONT',
        visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'EgpWaf', sampledRequestsEnabled: true },
        rules: [
          {
            name: 'RateLimit', priority: 1, action: { block: {} },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RateLimit', sampledRequestsEnabled: true },
            statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' } },
          },
          {
            name: 'CommonRules', priority: 2, overrideAction: { none: {} },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'CommonRules', sampledRequestsEnabled: true },
            statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } },
          },
          {
            name: 'SQLiRules', priority: 3, overrideAction: { none: {} },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'SQLiRules', sampledRequestsEnabled: true },
            statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesSQLiRuleSet' } },
          },
        ],
      });
      (distProps as any).webAclId = webAcl.attrArn;
    }

    return new cloudfront.Distribution(this, 'Distribution', distProps);
  }

  private createCognitoUserPools() {
    const envSuffix = this.config.envName === 'prod' ? '' : `-${this.config.envName}`;
    const removalPolicy = this.config.removalPolicy;

    const purchaser = new cognito.UserPool(this, 'PurchaserUserPool', {
      userPoolName: `egp-purchasers${envSuffix}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });
    purchaser.addClient('PurchaserAppClient', { authFlows: { userPassword: true, userSrp: true }, preventUserExistenceErrors: true });

    const partner = new cognito.UserPool(this, 'PartnerUserPool', {
      userPoolName: `egp-partners${envSuffix}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });
    partner.addClient('PartnerAppClient', { authFlows: { userPassword: true, userSrp: true }, preventUserExistenceErrors: true });

    const admin = new cognito.UserPool(this, 'AdminUserPool', {
      userPoolName: `egp-admins${envSuffix}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy,
    });
    admin.addClient('AdminAppClient', { authFlows: { userPassword: true, userSrp: true }, preventUserExistenceErrors: true });

    return { purchaser, partner, admin };
  }

  private createSecrets(): void {
    new secretsmanager.Secret(this, 'StripeApiKeys', {
      secretName: `egp/stripe-keys-${this.config.envName}`,
      description: 'Stripe API keys for payment processing',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ publishableKey: 'pk_placeholder', secretKey: 'sk_placeholder' }),
        generateStringKey: 'rotationToken',
      },
    });

    new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: `egp/db-creds-${this.config.envName}`,
      description: 'Aurora PostgreSQL master credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'egp_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });
  }

  private createDaxCluster(): string {
    const vpc = this.vpc as ec2.Vpc;

    const daxSg = new ec2.SecurityGroup(this, 'DaxSg', {
      vpc,
      description: 'Security group for DAX cluster',
      allowAllOutbound: false,
    });

    daxSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(8111),
      'Allow DAX access from within VPC',
    );

    const daxRole = new iam.Role(this, 'DaxRole', {
      assumedBy: new iam.ServicePrincipal('dax.amazonaws.com'),
      description: 'IAM role for DAX cluster to access DynamoDB',
    });

    daxRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:BatchGetItem', 'dynamodb:GetItem', 'dynamodb:Query',
        'dynamodb:Scan', 'dynamodb:BatchWriteItem', 'dynamodb:PutItem',
        'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:DescribeTable',
      ],
      resources: [`arn:aws:dynamodb:${this.region}:${this.account}:table/experience-gift-*`],
    }));

    const subnetGroup = new dax.CfnSubnetGroup(this, 'DaxSubnetGroup', {
      subnetGroupName: `egp-dax-snets-${this.config.envName}`,
      description: 'Subnet group for DAX cluster',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    const cluster = new dax.CfnCluster(this, 'DaxCluster', {
      clusterName: `egp-dax-${this.config.envName}`,
      description: 'DAX cluster for DynamoDB catalog caching',
      iamRoleArn: daxRole.roleArn,
      nodeType: this.config.daxNodeType,
      replicationFactor: this.config.daxReplicationFactor,
      subnetGroupName: subnetGroup.subnetGroupName!,
      securityGroupIds: [daxSg.securityGroupId],
      sseSpecification: { sseEnabled: true },
    });

    cluster.addDependency(subnetGroup);

    new cdk.CfnOutput(this, 'DaxEndpoint', {
      value: cluster.attrClusterDiscoveryEndpointUrl,
      description: 'DAX cluster discovery endpoint',
    });

    return cluster.attrClusterDiscoveryEndpointUrl;
  }

  private createObservability(): void {
    const serviceNames = [
      'catalog', 'order', 'gift-card', 'booking', 'partner', 'admin',
      'notification', 'auth', 'wishlist', 'community', 'payment',
    ];

    for (const svc of serviceNames) {
      new logs.LogGroup(this, `LogGroup-${svc}`, {
        logGroupName: `/egp/${this.config.envName}/${svc}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }
  }

  private createEcrRepositories(): Record<string, ecr.IRepository> {
    const serviceNames = [
      'catalog', 'order', 'gift-card', 'booking', 'partner', 'admin',
      'notification', 'auth', 'wishlist', 'community', 'payment',
    ];

    const repos: Record<string, ecr.Repository> = {};

    for (const svc of serviceNames) {
      repos[svc] = new ecr.Repository(this, `Ecr-${svc}`, {
        repositoryName: `egp/${svc}`,
        removalPolicy: this.config.removalPolicy,
        emptyOnDelete: this.config.envName === 'dev',
        lifecycleRules: [
          { maxImageCount: 10, description: 'Keep last 10 images' },
        ],
      });
    }

    return repos;
  }
}
