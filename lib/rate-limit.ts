import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export type RateLimitResult = {
  ok: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfterSeconds?: number;
};

// In-memory sliding-window store for fallback when Redis is unconfigured
type MemoryHit = { timestamp: number };
const memoryStore: Map<string, MemoryHit[]> =
  (globalThis as unknown as { __rlMemoryStore?: Map<string, MemoryHit[]> }).__rlMemoryStore
  ?? ((globalThis as unknown as { __rlMemoryStore?: Map<string, MemoryHit[]> }).__rlMemoryStore = new Map<string, MemoryHit[]>());

function checkMemoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits: MemoryHit[] = memoryStore.get(key) ?? [];
  const alive = hits.filter((h: MemoryHit) => now - h.timestamp < windowMs);

  if (alive.length >= max) {
    const oldest = alive[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest.timestamp + windowMs - now) / 1000));
    memoryStore.set(key, alive);
    return { ok: false, limit: max, remaining: 0, retryAfterSeconds };
  }

  alive.push({ timestamp: now });
  memoryStore.set(key, alive);
  return { ok: true, limit: max, remaining: max - alive.length };
}

let redisInstance: Redis | null = null;
function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      redisInstance = new Redis({ url, token });
      return redisInstance;
    } catch {
      return null;
    }
  }
  return null;
}

const upstashLimiters = new Map<string, Ratelimit>();

/**
 * Universal rate-limiter supporting distributed Upstash Redis with a graceful
 * sliding-window in-memory fallback.
 */
export async function rateLimit(
  identifier: string,
  options: {
    max: number;
    windowSeconds: number;
    prefix?: string;
  }
): Promise<RateLimitResult> {
  const { max, windowSeconds, prefix = "rl" } = options;
  const redis = getRedis();

  if (redis) {
    try {
      const limiterKey = `${prefix}:${max}:${windowSeconds}`;
      let limiter = upstashLimiters.get(limiterKey);
      if (!limiter) {
        limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
          prefix,
        });
        upstashLimiters.set(limiterKey, limiter);
      }

      const res = await limiter.limit(identifier);
      if (!res.success) {
        const retryAfterSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
        return {
          ok: false,
          limit: res.limit,
          remaining: res.remaining,
          reset: res.reset,
          retryAfterSeconds,
        };
      }
      return {
        ok: true,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
      };
    } catch (error) {
      console.warn("Upstash rate limiting failed, falling back to in-memory:", error);
    }
  }

  // In-memory sliding-window fallback
  const memoryKey = `${prefix}:${identifier}`;
  return checkMemoryRateLimit(memoryKey, max, windowSeconds * 1000);
}

/**
 * Resolves untamperable client IP addresses from trusted cloud headers.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;

  // Cloudflare
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Vercel Edge
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  // Standard reverse proxy
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Forwarded for
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return "127.0.0.1";
}

/** Backward compatibility for existing references */
export class RateLimit {
  private windowMs: number;
  private max: number;

  constructor(options: { windowMs: number; max: number }) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  check(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const res = checkMemoryRateLimit(key, this.max, this.windowMs);
    if (!res.ok) {
      return { ok: false, retryAfterSeconds: res.retryAfterSeconds ?? 1 };
    }
    return { ok: true };
  }
}

export function getClientKey(req: Request): string {
  return getClientIp(req);
}