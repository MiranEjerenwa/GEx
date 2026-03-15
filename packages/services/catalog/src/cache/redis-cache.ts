import Redis from 'ioredis';
import { Logger } from '@experience-gift/shared-types';

export interface RedisCacheOptions {
  host: string;
  port: number;
  defaultTtlSeconds?: number;
  keyPrefix?: string;
}

export class RedisCache {
  private readonly client: Redis;
  private readonly logger: Logger;
  private readonly defaultTtlSeconds: number;
  private readonly keyPrefix: string;

  constructor(options: RedisCacheOptions, logger: Logger, client?: Redis) {
    this.logger = logger;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 300;
    this.keyPrefix = options.keyPrefix ?? 'catalog:';
    this.client = client ?? new Redis({
      host: options.host,
      port: options.port,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Redis cache connected');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const data = await this.client.get(prefixedKey);
      if (!data) {
        this.logger.debug('Cache miss', { key: prefixedKey });
        return null;
      }
      this.logger.debug('Cache hit', { key: prefixedKey });
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.warn('Cache get error, returning null', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const prefixedKey = this.keyPrefix + key;
      const ttl = ttlSeconds ?? this.defaultTtlSeconds;
      await this.client.set(prefixedKey, JSON.stringify(value), 'EX', ttl);
      this.logger.debug('Cache set', { key: prefixedKey, ttl });
    } catch (error) {
      this.logger.warn('Cache set error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      const prefixedKey = this.keyPrefix + key;
      await this.client.del(prefixedKey);
      this.logger.debug('Cache invalidated', { key: prefixedKey });
    } catch (error) {
      this.logger.warn('Cache invalidate error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const prefixedPattern = this.keyPrefix + pattern;
      const keys = await this.client.keys(prefixedPattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.debug('Cache pattern invalidated', { pattern: prefixedPattern, count: keys.length });
      }
    } catch (error) {
      this.logger.warn('Cache pattern invalidate error', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.logger.info('Redis cache disconnected');
  }

  getClient(): Redis {
    return this.client;
  }
}
