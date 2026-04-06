import * as cdk from 'aws-cdk-lib';

export type EnvironmentName = 'dev' | 'prod';

export interface EnvironmentConfig {
  envName: EnvironmentName;

  // VPC
  maxAzs: number;

  // ECS / Fargate
  fargateMinTasks: number;
  fargateMaxTasks: number;
  fargateCpu: number;
  fargateMemoryMiB: number;

  // Aurora Serverless v2
  auroraMinAcu: number;
  auroraMaxAcu: number;
  auroraMultiAz: boolean;
  auroraDeletionProtection: boolean;
  auroraBackupRetentionDays: number;

  // DAX
  daxNodeType: string;
  daxReplicationFactor: number;

  // General
  removalPolicy: cdk.RemovalPolicy;
  containerInsights: boolean;

  // S3
  s3Versioned: boolean;
}

const DEV_CONFIG: EnvironmentConfig = {
  envName: 'dev',

  maxAzs: 2,

  fargateMinTasks: 1,
  fargateMaxTasks: 3,
  fargateCpu: 256,
  fargateMemoryMiB: 512,

  auroraMinAcu: 0.5,
  auroraMaxAcu: 2,
  auroraMultiAz: false,
  auroraDeletionProtection: false,
  auroraBackupRetentionDays: 1,

  daxNodeType: 'dax.t3.small',
  daxReplicationFactor: 1,

  removalPolicy: cdk.RemovalPolicy.DESTROY,
  containerInsights: false,

  s3Versioned: false,
};

const PROD_CONFIG: EnvironmentConfig = {
  envName: 'prod',

  maxAzs: 2,

  fargateMinTasks: 2,
  fargateMaxTasks: 10,
  fargateCpu: 256,
  fargateMemoryMiB: 512,

  auroraMinAcu: 0.5,
  auroraMaxAcu: 16,
  auroraMultiAz: true,
  auroraDeletionProtection: true,
  auroraBackupRetentionDays: 7,

  daxNodeType: 'dax.t3.medium',
  daxReplicationFactor: 2,

  removalPolicy: cdk.RemovalPolicy.RETAIN,
  containerInsights: true,

  s3Versioned: true,
};

const CONFIGS: Record<EnvironmentName, EnvironmentConfig> = {
  dev: DEV_CONFIG,
  prod: PROD_CONFIG,
};

export function getConfig(app: cdk.App): EnvironmentConfig {
  const envName = (app.node.tryGetContext('env') as EnvironmentName) ?? 'dev';
  const config = CONFIGS[envName];
  if (!config) {
    throw new Error(`Unknown environment: "${envName}". Use -c env=dev or -c env=prod`);
  }
  return config;
}