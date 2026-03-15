import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly rdsInstances: Record<string, rds.DatabaseInstance>;
  public readonly dynamoTables: Record<string, dynamodb.Table>;
  public readonly rdsSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // ─── KMS Key for RDS encryption at rest ────────────────────────────
    const rdsEncryptionKey = new kms.Key(this, 'RdsEncryptionKey', {
      alias: 'experience-gift/rds',
      description: 'KMS key for RDS encryption at rest',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── RDS Security Group ────────────────────────────────────────────
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL instances',
      allowAllOutbound: false,
    });

    this.rdsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from within VPC',
    );

    // ─── RDS PostgreSQL Instances ──────────────────────────────────────
    this.rdsInstances = {};
    const rdsServices = ['order', 'gift-card', 'booking', 'partner', 'payment'];

    for (const service of rdsServices) {
      const dbName = service.replace(/-/g, '_');
      this.rdsInstances[service] = new rds.DatabaseInstance(this, `Rds-${service}`, {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_16_3,
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        securityGroups: [this.rdsSecurityGroup as ec2.SecurityGroup],
        databaseName: `egp_${dbName}`,
        credentials: rds.Credentials.fromGeneratedSecret('egp_admin', {
          secretName: `experience-gift/rds-${service}-credentials`,
        }),
        multiAz: true,
        storageEncrypted: true,
        storageEncryptionKey: rdsEncryptionKey,
        allocatedStorage: 20,
        maxAllocatedStorage: 100,
        backupRetention: cdk.Duration.days(7),
        deletionProtection: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        monitoringInterval: cdk.Duration.seconds(60),
        enablePerformanceInsights: true,
        parameterGroup: new rds.ParameterGroup(this, `PgParams-${service}`, {
          engine: rds.DatabaseInstanceEngine.postgres({
            version: rds.PostgresEngineVersion.VER_16_3,
          }),
          parameters: {
            'log_statement': 'all',
            'log_min_duration_statement': '1000',
          },
        }),
      });
    }

    // ─── DynamoDB Tables ───────────────────────────────────────────────
    this.dynamoTables = {};

    // ── Catalog: experiences ───────────────────────────────────────────
    this.dynamoTables['catalog-experiences'] = this.createTable('CatalogExperiences', {
      tableName: 'experience-gift-catalog-experiences',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'partnerId-createdAt-index', pk: 'partnerId', sk: 'createdAt' },
        { indexName: 'categoryId-createdAt-index', pk: 'categoryId', sk: 'createdAt' },
        { indexName: 'primaryAgeGroup-createdAt-index', pk: 'primaryAgeGroup', sk: 'createdAt' },
      ],
    });

    // ── Catalog: occasions ─────────────────────────────────────────────
    this.dynamoTables['catalog-occasions'] = this.createTable('CatalogOccasions', {
      tableName: 'experience-gift-catalog-occasions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    // ── Catalog: occasion_experience_mappings ──────────────────────────
    this.dynamoTables['catalog-occasion-mappings'] = this.createTable('CatalogOccasionMappings', {
      tableName: 'experience-gift-catalog-occasion-mappings',
      partitionKey: { name: 'occasionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'experienceId-occasionId-index', pk: 'experienceId', sk: 'occasionId' },
      ],
    });

    // ── Catalog: age_group_experience_mappings ─────────────────────────
    this.dynamoTables['catalog-age-group-mappings'] = this.createTable('CatalogAgeGroupMappings', {
      tableName: 'experience-gift-catalog-age-group-mappings',
      partitionKey: { name: 'ageGroup', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'experienceId-ageGroup-index', pk: 'experienceId', sk: 'ageGroup' },
      ],
    });

    // ── Catalog: gift_card_templates ───────────────────────────────────
    this.dynamoTables['catalog-templates'] = this.createTable('CatalogTemplates', {
      tableName: 'experience-gift-catalog-templates',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'occasionId-createdAt-index', pk: 'occasionId', sk: 'createdAt' },
      ],
    });

    // ── Catalog: curated_collections ───────────────────────────────────
    this.dynamoTables['catalog-collections'] = this.createTable('CatalogCollections', {
      tableName: 'experience-gift-catalog-collections',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'occasionId-createdAt-index', pk: 'occasionId', sk: 'createdAt' },
      ],
    });

    // ── Catalog: categories ────────────────────────────────────────────
    this.dynamoTables['catalog-categories'] = this.createTable('CatalogCategories', {
      tableName: 'experience-gift-catalog-categories',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    // ── Catalog: time_slots ────────────────────────────────────────────
    this.dynamoTables['catalog-time-slots'] = this.createTable('CatalogTimeSlots', {
      tableName: 'experience-gift-catalog-time-slots',
      partitionKey: { name: 'experienceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'slotId', type: dynamodb.AttributeType.STRING },
    });

    // ── Admin: action_log ──────────────────────────────────────────────
    this.dynamoTables['admin-action-log'] = this.createTable('AdminActionLog', {
      tableName: 'experience-gift-admin-action-log',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'adminId-createdAt-index', pk: 'adminId', sk: 'createdAt' },
      ],
    });

    // ── Admin: platform_settings ───────────────────────────────────────
    this.dynamoTables['admin-platform-settings'] = this.createTable('AdminPlatformSettings', {
      tableName: 'experience-gift-admin-platform-settings',
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
    });

    // ── Wishlist: wishlists ────────────────────────────────────────────
    this.dynamoTables['wishlists'] = this.createTable('Wishlists', {
      tableName: 'experience-gift-wishlists',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'userId-createdAt-index', pk: 'userId', sk: 'createdAt' },
        { indexName: 'shareToken-index', pk: 'shareToken' },
      ],
    });

    // ── Wishlist: wishlist_items ────────────────────────────────────────
    this.dynamoTables['wishlist-items'] = this.createTable('WishlistItems', {
      tableName: 'experience-gift-wishlist-items',
      partitionKey: { name: 'wishlistId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
    });

    // ── Community: shared_moments ──────────────────────────────────────
    this.dynamoTables['community-shared-moments'] = this.createTable('CommunitySharedMoments', {
      tableName: 'experience-gift-community-shared-moments',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'bookingId-index', pk: 'bookingId' },
        { indexName: 'userId-createdAt-index', pk: 'userId', sk: 'createdAt' },
        { indexName: 'status-publishedAt-index', pk: 'status', sk: 'publishedAt' },
      ],
    });

    // ── Community: community_impact_metrics ─────────────────────────────
    this.dynamoTables['community-impact-metrics'] = this.createTable('CommunityImpactMetrics', {
      tableName: 'experience-gift-community-impact-metrics',
      partitionKey: { name: 'metricKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'metricPeriod', type: dynamodb.AttributeType.STRING },
    });

    // ── Community: impact_badges ────────────────────────────────────────
    this.dynamoTables['community-impact-badges'] = this.createTable('CommunityImpactBadges', {
      tableName: 'experience-gift-community-impact-badges',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'badgeType', type: dynamodb.AttributeType.STRING },
    });

    // ── Notification: notification_log ──────────────────────────────────
    this.dynamoTables['notification-log'] = this.createTable('NotificationLog', {
      tableName: 'experience-gift-notification-log',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      gsis: [
        { indexName: 'giftCardId-lastAttemptAt-index', pk: 'giftCardId', sk: 'lastAttemptAt' },
      ],
    });
  }

  // ─── Helper: create DynamoDB table with optional GSIs ────────────────
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
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
