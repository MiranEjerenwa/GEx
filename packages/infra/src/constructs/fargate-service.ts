import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as path from 'path';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';

export interface FargateServiceProps {
  serviceName: string;
  cluster: ecs.ICluster;
  vpc: ec2.IVpc;
  cloudMapNamespace: servicediscovery.IPrivateDnsNamespace;
  listener: elbv2.IApplicationListener;
  pathPattern: string;
  priority: number;
  containerPort?: number;
  healthCheckPath?: string;
  cpu?: number;
  memoryLimitMiB?: number;
  minTaskCount?: number;
  maxTaskCount?: number;
  targetCpuUtilization?: number;
  targetMemoryUtilization?: number;
  environment?: Record<string, string>;
}

export class FargateService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly logGroup: logs.LogGroup;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const {
      serviceName, cluster, vpc, cloudMapNamespace,
      listener, pathPattern, priority,
      containerPort = 3000, healthCheckPath = '/health',
      cpu = 256, memoryLimitMiB = 512,
      minTaskCount = 1, maxTaskCount = 10,
      targetCpuUtilization = 70, targetMemoryUtilization = 70,
      environment = {},
    } = props;

    // CDK builds the Docker image and pushes to ECR automatically
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const imageAsset = new DockerImageAsset(this, 'Image', {
      directory: repoRoot,
      buildArgs: { SERVICE: serviceName, CACHE_BUST: new Date().toISOString() },
      platform: Platform.LINUX_AMD64,
      // Cache layers by service name to speed up rebuilds
      assetName: `egp-${serviceName}`,
    });

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/experience-gift/ecs/${serviceName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: `experience-gift-${serviceName}`,
      cpu,
      memoryLimitMiB,
    });

    this.taskDefinition.addContainer('app', {
      containerName: serviceName,
      image: ecs.ContainerImage.fromDockerImageAsset(imageAsset),
      essential: true,
      portMappings: [{ containerPort, protocol: ecs.Protocol.TCP }],
      environment: {
        SERVICE_NAME: serviceName,
        PORT: String(containerPort),
        NODE_ENV: 'production',
        ...environment,
      },
      logging: ecs.LogDrivers.awsLogs({ logGroup: this.logGroup, streamPrefix: serviceName }),
      healthCheck: {
        command: ['CMD-SHELL', `wget -qO- http://localhost:${containerPort}${healthCheckPath} || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    this.service = new ecs.FargateService(this, 'Service', {
      serviceName: `experience-gift-${serviceName}`,
      cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: minTaskCount,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      cloudMapOptions: {
        name: serviceName,
        cloudMapNamespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      },
    });

    // Register with shared ALB via path-based routing
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: `egp-${serviceName}-tg`,
      vpc,
      port: containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: healthCheckPath,
        protocol: elbv2.Protocol.HTTP,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    this.targetGroup.addTarget(this.service);

    new elbv2.ApplicationListenerRule(this, 'ListenerRule', {
      listener,
      priority,
      conditions: [elbv2.ListenerCondition.pathPatterns([`/${pathPattern}`, `/${pathPattern}/*`])],
      targetGroups: [this.targetGroup],
    });

    this.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(containerPort),
      `ALB to ${serviceName}`,
    );

    const scaling = this.service.autoScaleTaskCount({
      minCapacity: minTaskCount,
      maxCapacity: maxTaskCount,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: targetCpuUtilization,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: targetMemoryUtilization,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
  }
}