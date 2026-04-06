import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  config: EnvironmentConfig;
}

export class DatabaseStack extends cdk.Stack {
  public readonly auroraClusters: Record<string, rds.DatabaseCluster>;
  public readonly dynamoTables: Record<string, dynamodb.Table>;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;

  private readonly config: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);
    this.config = props.config;

    const { vpc } = props;

    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Security group for Aurora Serverless v2 clusters',
      allowAllOutbound: false,
    });

    this.rdsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from within VPC',
    );

    // --- Aurora Serverless v2 Clusters ---
    this.auroraClusters = {};
    const dbServices = ['order', 'gift-card', 'booking', 'partner', 'payment'];

    for (const service of dbServices) {
      const dbName = service.replace(/-/g, '_');

      const cluster = new rds.DatabaseCluster(this, `Aurora-${service}`, {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_16_4,
        }),
        serverlessV2MinCapacity: this.config.auroraMinAcu,
        serverlessV2MaxCapacity: this.config.auroraMaxAcu,
        writer: rds.ClusterInstance.serverlessV2(`writer-${service}`, {
          publiclyAccessible: false,
        }),
        ...(this.config.auroraMultiAz
          ? {
              readers: [
                rds.ClusterInstance.serverlessV2(`reader-${service}`, {
                  publiclyAccessible: false,
                  scaleWithWriter: true,
                }),
              ],
            }
          : {}),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        securityGroups: [this.rdsSecurityGroup as ec2.SecurityGroup],
        defaultDatabaseName: `egp_${dbName}`,
        credentials: rds.Credentials.fromGeneratedSecret('egp_admin', {
          secretName: `experience-gift/aurora-${service}-credentials-${this.config.envName}`,
        }),
        storageEncrypted: true,
        backup: { retention: cdk.Duration.days(this.config.auroraBackupRetentionDays) },
        deletionProtection: this.config.auroraDeletionProtection,
        removalPolicy: this.config.removalPolicy,
      });

      this.auroraClusters[service] = cluster;
    }

    // --- DynamoDB Tables ---
    this.dynamoTables = {};

    this.dynamoTables['catalog-experiences'] = this.createTable('CatalogExperiences', {
      tableName: `experience-gift-catalog-experiences-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'partnerId-createdAt-index', pk: 'partnerId', sk: 'createdAt' },
        { indexName: 'categoryId-createdAt-index', pk: 'categoryId', sk: 'createdAt' },
        { indexName: 'primaryAgeGroup-createdAt-index', pk: 'primaryAgeGroup', sk: 'createdAt' },
      ],
    });

    this.dynamoTables['catalog-occasions'] = this.createTable('CatalogOccasions', {
      tableName: `experience-gift-catalog-occasions-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['catalog-occasion-mappings'] = this.createTable('CatalogOccasionMappings', {
      tableName: `experience-gift-catalog-occasion-mappings-${this.config.envName}`,
      partitionKey: { name: 'occasionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'experienceId-occasionId-index', pk: 'experienceId', sk: 'occasionId' }],
    });

    this.dynamoTables['catalog-age-group-mappings'] = this.createTable('CatalogAgeGroupMappings', {
      tableName: `experience-gift-catalog-age-group-mappings-${this.config.envName}`,
      partitionKey: { name: 'ageGroup', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'experienceId-ageGroup-index', pk: 'experienceId', sk: 'ageGroup' }],
    });

    this.dynamoTables['catalog-templates'] = this.createTable('CatalogTemplates', {
      tableName: `experience-gift-catalog-templates-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'occasionId-createdAt-index', pk: 'occasionId', sk: 'createdAt' }],
    });

    this.dynamoTables['catalog-collections'] = this.createTable('CatalogCollections', {
      tableName: `experience-gift-catalog-collections-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'occasionId-createdAt-index', pk: 'occasionId', sk: 'createdAt' }],
    });

    this.dynamoTables['catalog-categories'] = this.createTable('CatalogCategories', {
      tableName: `experience-gift-catalog-categories-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['catalog-time-slots'] = this.createTable('CatalogTimeSlots', {
      tableName: `experience-gift-catalog-time-slots-${this.config.envName}`,
      partitionKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'slotId', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['admin-action-log'] = this.createTable('AdminActionLog', {
      tableName: `experience-gift-admin-action-log-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'adminId-createdAt-index', pk: 'adminId', sk: 'createdAt' }],
    });

    this.dynamoTables['admin-platform-settings'] = this.createTable('AdminPlatformSettings', {
      tableName: `experience-gift-admin-platform-settings-${this.config.envName}`,
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['wishlists'] = this.createTable('Wishlists', {
      tableName: `experience-gift-wishlists-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'userId-createdAt-index', pk: 'userId', sk: 'createdAt' },
        { indexName: 'shareToken-index', pk: 'shareToken' },
      ],
    });

    this.dynamoTables['wishlist-items'] = this.createTable('WishlistItems', {
      tableName: `experience-gift-wishlist-items-${this.config.envName}`,
      partitionKey: { name: 'wishlistId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['community-shared-moments'] = this.createTable('CommunitySharedMoments', {
      tableName: `experience-gift-community-shared-moments-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'bookingId-index', pk: 'bookingId' },
        { indexName: 'userId-createdAt-index', pk: 'userId', sk: 'createdAt' },
        { indexName: 'status-publishedAt-index', pk: 'status', sk: 'publishedAt' },
      ],
    });

    this.dynamoTables['community-impact-metrics'] = this.createTable('CommunityImpactMetrics', {
      tableName: `experience-gift-community-impact-metrics-${this.config.envName}`,
      partitionKey: { name: 'metricKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'metricPeriod', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['community-impact-badges'] = this.createTable('CommunityImpactBadges', {
      tableName: `experience-gift-community-impact-badges-${this.config.envName}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'badgeType', type: dynamodb.AttributeType.STRING },
    });

    this.dynamoTables['gift-cards'] = this.createTable('GiftCards', {
      tableName: `experience-gift-gift-cards-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'redemptionCode-index', pk: 'redemptionCode' },
        { indexName: 'orderId-index', pk: 'orderId' },
        { indexName: 'recipientEmail-createdAt-index', pk: 'recipientEmail', sk: 'createdAt' },
      ],
    });

    this.dynamoTables['orders'] = this.createTable('Orders', {
      tableName: `experience-gift-orders-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'reference_number-index', pk: 'reference_number' },
        { indexName: 'purchaser_email-created_at-index', pk: 'purchaser_email', sk: 'created_at' },
        { indexName: 'recipient_email-created_at-index', pk: 'recipient_email', sk: 'created_at' },
      ],
    });

    this.dynamoTables['notification-log'] = this.createTable('NotificationLog', {
      tableName: `experience-gift-notification-log-${this.config.envName}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [{ indexName: 'giftCardId-lastAttemptAt-index', pk: 'giftCardId', sk: 'lastAttemptAt' }],
    });
  }

  private createTable(
    id: string,
    config: {
      tableName: string;
      partitionKey: { name: string; type: dynamodb.AttributeType };
      sortKey?: { name: string; type: dynamodb.AttributeType };
      gsis?: Array<{ indexName: string; pk: string; sk?: string }>;
    },
  ): dynamodb.Table {
    const table = new dynamodb.Table(this, id, {
      tableName: config.tableName,
      partitionKey: config.partitionKey,
      sortKey: config.sortKey,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: this.config.envName === 'prod',
      removalPolicy: this.config.removalPolicy,
    });

    for (const gsi of config.gsis ?? []) {
      table.addGlobalSecondaryIndex({
        indexName: gsi.indexName,
        partitionKey: { name: gsi.pk, type: dynamodb.AttributeType.STRING },
        ...(gsi.sk ? { sortKey: { name: gsi.sk, type: dynamodb.AttributeType.STRING } } : {}),
        projectionType: dynamodb.ProjectionType.ALL,
      });
    }

    return table;
  }
}