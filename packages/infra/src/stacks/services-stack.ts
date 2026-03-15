import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { FargateService } from '../constructs/fargate-service';

export interface ServicesStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;
  api: apigateway.RestApi;
}

/** Service definition for configuring each microservice */
interface ServiceConfig {
  /** Service name used for resource naming and discovery */
  name: string;
  /** API Gateway resource path (must match the resource stubs in shared infra) */
  apiRoute: string;
  /** Health check path */
  healthCheckPath?: string;
  /** CPU units (default 256) */
  cpu?: number;
  /** Memory MiB (default 512) */
  memoryLimitMiB?: number;
  /** Additional environment variables */
  environment?: Record<string, string>;
}

const SERVICE_CONFIGS: ServiceConfig[] = [
  { name: 'catalog', apiRoute: 'catalog' },
  { name: 'order', apiRoute: 'orders' },
  { name: 'gift-card', apiRoute: 'gift-cards' },
  { name: 'booking', apiRoute: 'bookings' },
  { name: 'partner', apiRoute: 'partners' },
  { name: 'admin', apiRoute: 'admin' },
  { name: 'notification', apiRoute: 'notifications' },
  { name: 'auth', apiRoute: 'auth' },
  { name: 'wishlist', apiRoute: 'wishlists' },
  { name: 'community', apiRoute: 'community' },
  { name: 'payment', apiRoute: 'payments' },
];

export class ServicesStack extends cdk.Stack {
  public readonly services: Record<string, FargateService> = {};

  constructor(scope: Construct, id: string, props: ServicesStackProps) {
    super(scope, id, props);

    const { vpc, ecsCluster, api } = props;

    // ─── Cloud Map Private DNS Namespace ────────────────────────────────
    const cloudMapNamespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceDiscovery', {
      name: 'experience-gift.local',
      vpc,
      description: 'Private DNS namespace for internal service discovery',
    });

    // ─── VPC Link for API Gateway → private ALBs ───────────────────────
    const vpcLink = new apigateway.VpcLink(this, 'VpcLink', {
      vpcLinkName: 'experience-gift-vpc-link',
      description: 'VPC Link connecting API Gateway to internal service ALBs',
    });

    // ─── Create each service ───────────────────────────────────────────
    for (const config of SERVICE_CONFIGS) {
      const svc = new FargateService(this, `Svc-${config.name}`, {
        serviceName: config.name,
        cluster: ecsCluster,
        vpc,
        cloudMapNamespace,
        healthCheckPath: config.healthCheckPath ?? '/health',
        cpu: config.cpu,
        memoryLimitMiB: config.memoryLimitMiB,
        environment: config.environment,
      });

      this.services[config.name] = svc;

      // Register ALB with VPC Link
      vpcLink.addTargets(svc.loadBalancer);

      // Wire API Gateway resource → ALB via VPC Link integration
      this.configureApiRoute(api, config.apiRoute, svc, vpcLink);
    }
  }

  /**
   * Configures API Gateway proxy integration from the existing resource stub
   * to the service ALB via VPC Link.
   */
  private configureApiRoute(
    api: apigateway.RestApi,
    routePath: string,
    svc: FargateService,
    vpcLink: apigateway.VpcLink,
  ): void {
    // The resource stubs were already created in SharedInfrastructureStack
    const resource = api.root.getResource(routePath);
    if (!resource) {
      throw new Error(`API Gateway resource '${routePath}' not found — ensure shared infra creates it`);
    }

    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `http://${svc.loadBalancer.loadBalancerDnsName}/{proxy}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });

    // Add {proxy+} catch-all under the service resource
    const proxyResource = resource.addResource('{proxy+}');
    proxyResource.addMethod('ANY', integration, {
      requestParameters: { 'method.request.path.proxy': true },
    });

    // Also handle requests to the root resource path itself
    resource.addMethod('ANY', new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `http://${svc.loadBalancer.loadBalancerDnsName}/`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink,
      },
    }));
  }
}
