import type { RequestHandler } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number | (() => number);
  now?: () => number;
  keyPrefix?: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export function createRateLimitTracker(options: RateLimitOptions) {
  const buckets = new Map<string, RateLimitBucket>();
  const now = options.now ?? Date.now;

  return {
    check(key: string): RateLimitDecision {
      const currentTime = now();
      const maxRequests = resolveMaxRequests(options.maxRequests);
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= currentTime) {
        const resetAt = currentTime + options.windowMs;
        buckets.set(key, { count: 1, resetAt });

        return {
          allowed: true,
          remaining: Math.max(maxRequests - 1, 0),
          retryAfterSeconds: 0,
          resetAt
        };
      }

      if (bucket.count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - currentTime) / 1000), 1),
          resetAt: bucket.resetAt
        };
      }

      bucket.count += 1;

      return {
        allowed: true,
        remaining: Math.max(maxRequests - bucket.count, 0),
        retryAfterSeconds: 0,
        resetAt: bucket.resetAt
      };
    },
    clear() {
      buckets.clear();
    }
  };
}

export function createInMemoryRateLimiter(options: RateLimitOptions): RequestHandler {
  const tracker = createRateLimitTracker(options);
  const keyPrefix = options.keyPrefix ?? "rate-limit";

  return (request, response, next) => {
    const decision = tracker.check(`${keyPrefix}:${getClientIp(request)}`);

    response.setHeader("RateLimit-Remaining", String(decision.remaining));
    response.setHeader("RateLimit-Reset", String(Math.ceil(decision.resetAt / 1000)));

    if (!decision.allowed) {
      response.setHeader("Retry-After", String(decision.retryAfterSeconds));
      response.status(429).json({
        error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요."
      });
      return;
    }

    next();
  };
}

export function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveMaxRequests(maxRequests: number | (() => number)): number {
  const resolved = typeof maxRequests === "function" ? maxRequests() : maxRequests;
  return Math.max(Math.round(resolved), 1);
}

function getClientIp(request: Parameters<RequestHandler>[0]): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}
