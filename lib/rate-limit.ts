type RateLimitStore = { timestamp: number }[];

type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export class RateLimit {
  private store = new Map<string, RateLimitStore>();
  private windowMs: number;
  private max: number;

  constructor(options: { windowMs: number; max: number }) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  private cleanup(now: number) {
    for (const [key, hits] of this.store) {
      const alive = hits.filter((h) => now - h.timestamp < this.windowMs);
      if (alive.length === 0) this.store.delete(key);
      else this.store.set(key, alive);
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    this.cleanup(now);
    const hits = this.store.get(key) ?? [];
    const recent = hits.filter((h) => now - h.timestamp < this.windowMs);
    if (recent.length >= this.max) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest.timestamp + this.windowMs - now) / 1000));
      this.store.set(key, recent);
      return { ok: false, retryAfterSeconds };
    }
    recent.push({ timestamp: now });
    this.store.set(key, recent);
    return { ok: true };
  }
}

export function getClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}