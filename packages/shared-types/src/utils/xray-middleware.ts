/**
 * X-Ray tracing middleware for Express.
 * Creates or continues X-Ray segments and propagates trace IDs.
 */

export interface XRaySegment {
  traceId: string;
  segmentId: string;
  name: string;
  startTime: number;
  endTime?: number;
  error?: boolean;
  metadata?: Record<string, unknown>;
}

export interface XRayMiddlewareOptions {
  serviceName: string;
}

/**
 * Express-compatible middleware that creates/continues X-Ray segments.
 * Extracts trace ID from the `X-Amzn-Trace-Id` header or generates a new one.
 * Attaches segment info to `req` for downstream use.
 */
export function createXRayMiddleware(options: XRayMiddlewareOptions) {
  return (req: XRayRequest, res: XRayResponse, next: () => void): void => {
    const incomingTraceHeader = req.headers?.['x-amzn-trace-id'] as string | undefined;
    const traceId = incomingTraceHeader
      ? parseTraceId(incomingTraceHeader)
      : generateTraceId();
    const segmentId = generateSegmentId();

    const segment: XRaySegment = {
      traceId,
      segmentId,
      name: options.serviceName,
      startTime: Date.now() / 1000,
    };

    req.xraySegment = segment;
    req.traceId = traceId;

    // Set trace header on response
    const traceHeader = `Root=${traceId};Parent=${segmentId};Sampled=1`;
    res.setHeader('X-Amzn-Trace-Id', traceHeader);

    // Close segment when response finishes
    res.on('finish', () => {
      segment.endTime = Date.now() / 1000;
      if (res.statusCode >= 500) {
        segment.error = true;
      }
    });

    next();
  };
}

/** Minimal request interface for Express compatibility without importing Express */
export interface XRayRequest {
  headers?: Record<string, string | string[] | undefined>;
  xraySegment?: XRaySegment;
  traceId?: string;
}

/** Minimal response interface for Express compatibility without importing Express */
export interface XRayResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: string, listener: () => void): void;
}

function parseTraceId(header: string): string {
  const match = header.match(/Root=([^;]+)/);
  return match ? match[1] : generateTraceId();
}

function generateTraceId(): string {
  const time = Math.floor(Date.now() / 1000).toString(16);
  const id = randomHex(24);
  return `1-${time}-${id}`;
}

function generateSegmentId(): string {
  return randomHex(16);
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
