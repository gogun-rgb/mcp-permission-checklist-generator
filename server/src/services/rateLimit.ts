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
  cleanupIntervalMs?: number;
  maxBuckets?: number;
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
  const cleanupIntervalMs = readPositiveInteger(
    String(options.cleanupIntervalMs ?? ""),
    60_000
  );
  const maxBuckets = readPositiveInteger(String(options.maxBuckets ?? ""), 10_000);
  let lastCleanupAt = 0;

  return {
    check(key: string): RateLimitDecision {
      const currentTime = now();
      const maxRequests = resolveMaxRequests(options.maxRequests);
      runLazyCleanup(currentTime);
      ensureCapacityFor(key, currentTime);

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
    pruneExpired(currentTime: number = now()): number {
      return pruneExpiredBuckets(currentTime);
    },
    size(): number {
      return buckets.size;
    },
    clear() {
      buckets.clear();
    }
  };

  function runLazyCleanup(currentTime: number): void {
    if (
      currentTime - lastCleanupAt >= cleanupIntervalMs ||
      buckets.size > maxBuckets
    ) {
      pruneExpiredBuckets(currentTime);
      lastCleanupAt = currentTime;
    }
  }

  function ensureCapacityFor(key: string, currentTime: number): void {
    if (buckets.has(key) || buckets.size < maxBuckets) {
      return;
    }

    pruneExpiredBuckets(currentTime);

    if (buckets.size >= maxBuckets) {
      pruneOldestBuckets(maxBuckets - 1);
    }
  }

  function pruneExpiredBuckets(currentTime: number): number {
    let deleted = 0;

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= currentTime) {
        buckets.delete(key);
        deleted += 1;
      }
    }

    return deleted;
  }

  function pruneOldestBuckets(targetSize: number): void {
    const entries = Array.from(buckets.entries()).sort(
      (left, right) => left[1].resetAt - right[1].resetAt
    );

    for (const [key] of entries) {
      if (buckets.size <= targetSize) {
        break;
      }

      buckets.delete(key);
    }
  }
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
