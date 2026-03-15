import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';

export interface FargateServiceProps {
  /** Human-readable service name (e.g. "catalog", "gift-card") */
  serviceName: string;

  /** ECS cluster to deploy into */
  cluster: ecs.ICluster;

  /** VPC for ALB and service placement */
  vpc: ec2.IVpc;

  /** Cloud Map namespace for service discovery */
  cloudMapNamespace: servicediscovery.IPrivateDnsNamespace;

  /** Container port the service listens on (default 3000) */
  containerPort?: number;

  /** Health check path (default /health) */
  healthCheckPath?: string;

  /** CPU units for the task (default 256 = 0.25 vCPU) */
  cpu?: number;

  /** Memory in MiB for the task (default 512) */
  memoryLimitMiB?: number;

  /** Minimum number of tasks (default 2) */
  minTaskCount?: number;

  /** Maximum number of tasks (default 10) */
  maxTaskCount?: number;

  /** Target CPU utilization percentage for auto-scaling (default 70) */
  targetCpuUtilization?: number;

  /** Target memory utilization percentage for auto-scaling (default 70) */
  targetMemoryUtilization?: number;

  /** Additional environment variables for the main container */
  environment?: Record<string, string>;
}

/**
 * Reusable CDK construct that creates an ECS Fargate service with:
 * - Internal ALB in private subnets
 * - Health check configuration
 * - Auto-scaling (target tracking CPU + memory)
 * - CloudWatch log group
 * - X-Ray daemon sidecar
 * - Cloud Map service discovery registration
 */
export class FargateService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.NetworkLoadBalancer;
  public readonly listener: elbv2.NetworkListener;
  public readonly targetGroup: elbv2.NetworkTargetGroup;
  public readonly logGroup: logs.LogGroup;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const {
      serviceName,
      cluster,
      vpc,
      cloudMapNamespace,
      containerPort = 3000,
      healthCheckPath = '/health',
      cpu = 256,
      memoryLimitMiB = 512,
      minTaskCount = 2,
      maxTaskCount = 10,
      targetCpuUtilization = 70,
      targetMemoryUtilization = 70,
      environment = {},
    } = props;

    // ─── CloudWatch Log Group ──────────────────────────────────────────
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/experience-gift/ecs/${serviceName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── Task Definition ───────────────────────────────────────────────
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: `experience-gift-${serviceName}`,
      cpu,
      memoryLimitMiB,
    });

    // Main application container
    this.taskDefinition.addContainer('app', {
      containerName: serviceName,
      image: ecs.ContainerImage.fromRegistry(`experience-gift/${serviceName}:latest`),
      essential: true,
      portMappings: [{ containerPort, protocol: ecs.Protocol.TCP }],
      environment: {
        SERVICE_NAME: serviceName,
        PORT: String(containerPort),
        NODE_ENV: 'production',
        AWS_XRAY_DAEMON_ADDRESS: 'localhost:2000',
        ...environment,
      },
      logging: ecs.LogDrivers.awsLogs({
        logGroup: this.logGroup,
        streamPrefix: serviceName,
      }),
      healthCheck: {
        command: ['CMD-SHELL', `curl -f http://localhost:${containerPort}${healthCheckPath} || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // X-Ray daemon sidecar
    this.taskDefinition.addContainer('xray-daemon', {
      containerName: 'xray-daemon',
      image: ecs.ContainerImage.fromRegistry('amazon/aws-xray-daemon:latest'),
      essential: false,
      portMappings: [
        { containerPort: 2000, protocol: ecs.Protocol.UDP },
      ],
      memoryReservationMiB: 64,
      logging: ecs.LogDrivers.awsLogs({
        logGroup: this.logGroup,
        streamPrefix: `${serviceName}-xray`,
      }),
    });

    // ─── Internal NLB ──────────────────────────────────────────────────
    this.loadBalancer = new elbv2.NetworkLoadBalancer(this, 'Nlb', {
      loadBalancerName: `egp-${serviceName}`,
      vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.targetGroup = new elbv2.NetworkTargetGroup(this, 'TargetGroup', {
      targetGroupName: `egp-${serviceName}-tg`,
      vpc,
      port: containerPort,
      protocol: elbv2.Protocol.TCP,
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

    this.listener = this.loadBalancer.addListener('TcpListener', {
      port: 80,
      defaultTargetGroups: [this.targetGroup],
    });

    // ─── ECS Fargate Service ───────────────────────────────────────────
    this.service = new ecs.FargateService(this, 'Service', {
      serviceName: `experience-gift-${serviceName}`,
      cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: minTaskCount,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      cloudMapOptions: {
        name: serviceName,
        cloudMapNamespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      },
    });

    // Register service with NLB target group
    this.targetGroup.addTarget(this.service);

    // NLB passes traffic through transparently — allow all private subnet traffic
    this.service.connections.allowFromAnyIpv4(
      ec2.Port.tcp(containerPort),
      `NLB to ${serviceName}`,
    );

    // ─── Auto-Scaling ──────────────────────────────────────────────────
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
