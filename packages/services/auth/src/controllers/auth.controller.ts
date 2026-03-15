import { Request, Response } from 'express';
import { CognitoService, AuthenticationError, MfaRequiredError } from '../services/cognito.service';
import { Logger } from '@experience-gift/shared-types';

export class AuthController {
  private cognitoService: CognitoService;
  private logger: Logger;

  constructor(cognitoService: CognitoService, logger: Logger) {
    this.cognitoService = cognitoService;
    this.logger = logger;
  }

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email, password, and name are required',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const tokens = await this.cognitoService.registerUser(email, password, name);
      res.status(201).json(tokens);
    } catch (error) {
      this.handleError(req, res, error, 'Registration failed');
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email and password are required',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const tokens = await this.cognitoService.authenticate(email, password, 'purchaser');
      res.status(200).json(tokens);
    } catch (error) {
      this.handleError(req, res, error, 'Login failed');
    }
  };

  partnerLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email and password are required',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const tokens = await this.cognitoService.authenticate(email, password, 'partner');
      res.status(200).json(tokens);
    } catch (error) {
      if (error instanceof MfaRequiredError) {
        // Partner pool has optional MFA — if triggered, return session for MFA completion
        res.status(200).json({
          challengeName: 'SOFTWARE_TOKEN_MFA',
          session: error.session,
          message: 'MFA verification required',
        });
        return;
      }
      this.handleError(req, res, error, 'Partner login failed');
    }
  };

  adminLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, mfaCode } = req.body;

      if (!email || !password || !mfaCode) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'email, password, and mfaCode are required for admin login',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const tokens = await this.cognitoService.authenticateWithMfa(email, password, mfaCode);
      res.status(200).json(tokens);
    } catch (error) {
      this.handleError(req, res, error, 'Admin login failed');
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken: tokenValue, pool } = req.body;

      if (!tokenValue) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'refreshToken is required',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const poolType = pool === 'partner' ? 'partner' : pool === 'admin' ? 'admin' : 'purchaser';
      const tokens = await this.cognitoService.refreshToken(tokenValue, poolType);
      res.status(200).json(tokens);
    } catch (error) {
      this.handleError(req, res, error, 'Token refresh failed');
    }
  };

  createPartnerCredentials = async (req: Request, res: Response): Promise<void> => {
    try {
      const { partnerId, email } = req.body;

      if (!partnerId || !email) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'partnerId and email are required',
            requestId: req.headers['x-request-id'] as string ?? '',
            traceId: req.headers['x-amzn-trace-id'] as string ?? '',
          },
        });
        return;
      }

      const credentials = await this.cognitoService.createPartnerCredentials(partnerId, email);
      res.status(201).json(credentials);
    } catch (error) {
      this.handleError(req, res, error, 'Failed to create partner credentials');
    }
  };

  private handleError(req: Request, res: Response, error: unknown, context: string): void {
    if (error instanceof AuthenticationError) {
      this.logger.warn(context, { error: error.message });
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message,
          requestId: req.headers['x-request-id'] as string ?? '',
          traceId: req.headers['x-amzn-trace-id'] as string ?? '',
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(context, { error: message });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: context,
        requestId: req.headers['x-request-id'] as string ?? '',
        traceId: req.headers['x-amzn-trace-id'] as string ?? '',
      },
    });
  }
}
