import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  GlobalSignOutCommand,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { AuthTokens, Logger } from '@experience-gift/shared-types';

export interface CognitoPoolConfig {
  userPoolId: string;
  clientId: string;
}

export interface PoolConfigs {
  purchaser: CognitoPoolConfig;
  partner: CognitoPoolConfig;
  admin: CognitoPoolConfig;
}

export type PoolType = 'purchaser' | 'partner' | 'admin';

export interface TempCredentials {
  email: string;
  temporaryPassword: string;
}

export class CognitoService {
  private client: CognitoIdentityProviderClient;
  private pools: PoolConfigs;
  private logger: Logger;

  constructor(pools: PoolConfigs, region: string, logger: Logger) {
    this.client = new CognitoIdentityProviderClient({ region });
    this.pools = pools;
    this.logger = logger;
  }

  private getPool(pool: PoolType): CognitoPoolConfig {
    return this.pools[pool];
  }

  async registerUser(email: string, password: string, name: string): Promise<AuthTokens> {
    const pool = this.getPool('purchaser');
    this.logger.info('Registering new purchaser/recipient user', { email });

    await this.client.send(
      new SignUpCommand({
        ClientId: pool.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ],
      }),
    );

    return this.authenticate(email, password, 'purchaser');
  }

  async authenticate(email: string, password: string, pool: PoolType): Promise<AuthTokens> {
    const poolConfig = this.getPool(pool);
    this.logger.info('Authenticating user', { email, pool });

    const response = await this.client.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: poolConfig.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    );

    if (response.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
      throw new MfaRequiredError(response.Session ?? '');
    }

    if (!response.AuthenticationResult) {
      throw new AuthenticationError('Authentication failed: no result returned');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken ?? '',
      refreshToken: response.AuthenticationResult.RefreshToken ?? '',
      idToken: response.AuthenticationResult.IdToken ?? '',
      expiresIn: response.AuthenticationResult.ExpiresIn ?? 3600,
    };
  }

  async authenticateWithMfa(
    email: string,
    password: string,
    mfaCode: string,
  ): Promise<AuthTokens> {
    const poolConfig = this.getPool('admin');
    this.logger.info('Authenticating admin user with MFA', { email });

    const authResponse = await this.client.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: poolConfig.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    );

    if (authResponse.ChallengeName !== ChallengeNameType.SOFTWARE_TOKEN_MFA) {
      throw new AuthenticationError('MFA challenge expected but not received for admin login');
    }

    const challengeResponse = await this.client.send(
      new RespondToAuthChallengeCommand({
        ClientId: poolConfig.clientId,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: authResponse.Session,
        ChallengeResponses: {
          USERNAME: email,
          SOFTWARE_TOKEN_MFA_CODE: mfaCode,
        },
      }),
    );

    if (!challengeResponse.AuthenticationResult) {
      throw new AuthenticationError('MFA verification failed');
    }

    return {
      accessToken: challengeResponse.AuthenticationResult.AccessToken ?? '',
      refreshToken: challengeResponse.AuthenticationResult.RefreshToken ?? '',
      idToken: challengeResponse.AuthenticationResult.IdToken ?? '',
      expiresIn: challengeResponse.AuthenticationResult.ExpiresIn ?? 3600,
    };
  }

  async refreshToken(refreshTokenValue: string, pool: PoolType): Promise<AuthTokens> {
    const poolConfig = this.getPool(pool);
    this.logger.info('Refreshing token', { pool });

    const response = await this.client.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: poolConfig.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshTokenValue,
        },
      }),
    );

    if (!response.AuthenticationResult) {
      throw new AuthenticationError('Token refresh failed');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken ?? '',
      refreshToken: refreshTokenValue,
      idToken: response.AuthenticationResult.IdToken ?? '',
      expiresIn: response.AuthenticationResult.ExpiresIn ?? 3600,
    };
  }

  async createPartnerCredentials(partnerId: string, email: string): Promise<TempCredentials> {
    const pool = this.getPool('partner');
    const temporaryPassword = this.generateTemporaryPassword();
    this.logger.info('Creating partner credentials', { partnerId, email });

    await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: pool.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:partnerId', Value: partnerId },
        ],
        MessageAction: 'SUPPRESS',
      }),
    );

    return { email, temporaryPassword };
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 16;
    let password = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      password += chars[randomValues[i] % chars.length];
    }
    return password;
  }
}

export class MfaRequiredError extends Error {
  public session: string;
  constructor(session: string) {
    super('MFA verification required');
    this.name = 'MfaRequiredError';
    this.session = session;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
