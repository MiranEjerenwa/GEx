/**
 * Exponential backoff retry helper.
 * Generic async retry with configurable max retries and base delay.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds (default: 1000). Actual delay = baseDelayMs * 2^attempt */
  baseDelayMs: number;
  /** Optional predicate to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

/**
 * Executes an async function with exponential backoff retry.
 * Delay doubles each attempt: baseDelayMs, baseDelayMs*2, baseDelayMs*4, ...
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (attempt === opts.maxRetries) {
        break;
      }

      if (opts.isRetryable && !opts.isRetryable(error)) {
        break;
      }

      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
