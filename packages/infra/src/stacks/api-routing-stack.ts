import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface ApiRoutingStackProps extends cdk.StackProps {
  alb: elbv2.IApplicationLoadBalancer;
  albListener: elbv2.IApplicationListener;
}

export class ApiRoutingStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiRoutingStackProps) {
    super(scope, id, props);

    const { alb, albListener } = props;

    // HTTP API v2 VPC Link natively supports ALBs
    const vpcLink = new apigwv2.VpcLink(this, 'VpcLink', {
      vpcLinkName: `egp-vpclink`,
      vpc: alb.vpc!,
      subnets: { subnetType: cdk.aws_ec2.SubnetType.PRIVATE_ISOLATED },
    });

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'experience-gift-api',
      description: 'Experience Gift Platform HTTP API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
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

    // Single catch-all route: proxy everything to the ALB
    // The ALB handles path-based routing to the correct service
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration('AlbIntegration', albListener, {
        vpcLink,
      }),
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL',
    });
  }
}