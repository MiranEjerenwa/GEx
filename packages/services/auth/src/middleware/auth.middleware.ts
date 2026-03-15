import { Request, Response, NextFunction } from 'express';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { TokenClaims, Logger } from '@experience-gift/shared-types';

export interface AuthRequest extends Request {
  user?: TokenClaims;
}

export interface AuthMiddlewareConfig {
  region: string;
  logger: Logger;
}

/**
 * Creates a reusable token validation middleware.
 * Validates the Bearer token against Cognito and attaches decoded claims to req.user.
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const client = new CognitoIdentityProviderClient({ region: config.region });
  const logger = config.logger;

  return (requiredRole?: TokenClaims['role']) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const token = authHeader.slice(7);

      try {
        const userResponse = await client.send(
          new GetUserCommand({ AccessToken: token }),
        );

        const attributes = userResponse.UserAttributes ?? [];
        const email = attributes.find((a) => a.Name === 'email')?.Value ?? '';
        const sub = userResponse.Username ?? '';
        const role = extractRole(attributes);

        const claims: TokenClaims = {
          sub,
          email,
          role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        if (requiredRole && claims.role !== requiredRole) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: `Access denied: requires ${requiredRole} role`,
              requestId: req.headers['x-request-id'] as string ?? '',
              traceId: req.headers['x-amzn-trace-id'] as string ?? '',
            },
          });
          return;
        }

        req.user = claims;
        next();
      } catch (error) {
        logger.error('Token validation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }
    };
  };
}

function extractRole(
  attributes: Array<{ Name?: string; Value?: string }>,
): TokenClaims['role'] {
  const partnerId = attributes.find((a) => a.Name === 'custom:partnerId')?.Value;
  if (partnerId) return 'partner';

  const adminFlag = attributes.find((a) => a.Name === 'custom:isAdmin')?.Value;
  if (adminFlag === 'true') return 'admin';

  return 'user';
}

/**
 * Standalone token validation function for use outside Express middleware context.
 * Useful for validating tokens in EventBridge handlers or other services.
 */
export async function validateToken(
  token: string,
  region: string,
): Promise<TokenClaims> {
  const client = new CognitoIdentityProviderClient({ region });

  const userResponse = await client.send(
    new GetUserCommand({ AccessToken: token }),
  );

  const attributes = userResponse.UserAttributes ?? [];
  const email = attributes.find((a) => a.Name === 'email')?.Value ?? '';
  const sub = userResponse.Username ?? '';
  const role = extractRole(attributes);

  return {
    sub,
    email,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}
