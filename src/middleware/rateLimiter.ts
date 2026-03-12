interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetAt: Date;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  limit: number;
  windowMs: number;
}

export class RateLimiter {
  private readonly buckets: Map<string, TokenBucket> = new Map();
  private readonly globalLimit: number;
  private readonly windowMs: number;
  private readonly perToolLimits: Map<string, number>;

  constructor(globalLimit: number, windowMs: number, perToolLimits?: Record<string, number>) {
    this.globalLimit = globalLimit;
    this.windowMs = windowMs;
    this.perToolLimits = new Map(Object.entries(perToolLimits || {}));
  }

  checkLimit(key: string): boolean {
    const bucket = this.getBucket(key);
    this.refillBucket(bucket);
    
    return bucket.tokens > 0;
  }

  async waitForSlot(key: string): Promise<void> {
    while (!this.checkLimit(key)) {
      const bucket = this.getBucket(key);
      const waitTime = this.getWaitTime(bucket);
      await this.sleep(waitTime);
    }
    
    this.consumeToken(key);
  }

  reset(key: string): void {
    const limit = this.getLimit(key);
    this.buckets.set(key, {
      tokens: limit,
      lastRefill: Date.now(),
      limit,
      windowMs: this.windowMs,
    });
  }

  getUsage(key: string): RateLimitStatus {
    const bucket = this.getBucket(key);
    this.refillBucket(bucket);
    
    return {
      limit: bucket.limit,
      remaining: bucket.tokens,
      resetAt: new Date(bucket.lastRefill + bucket.windowMs),
    };
  }

  private getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      const limit = this.getLimit(key);
      bucket = {
        tokens: limit,
        lastRefill: Date.now(),
        limit,
        windowMs: this.windowMs,
      };
      this.buckets.set(key, bucket);
    }
    
    return bucket;
  }

  private getLimit(key: string): number {
    if (key === 'global') {
      return this.globalLimit;
    }
    return this.perToolLimits.get(key) || this.globalLimit;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;

    if (timePassed >= bucket.windowMs) {
      bucket.tokens = bucket.limit;
      bucket.lastRefill = now;
    } else {
      const tokensToAdd = Math.floor((timePassed / bucket.windowMs) * bucket.limit);
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(bucket.limit, bucket.tokens + tokensToAdd);
        // Advance lastRefill only by the time consumed to generate these tokens,
        // preserving the fractional remainder for the next refill cycle.
        bucket.lastRefill += Math.floor(tokensToAdd * (bucket.windowMs / bucket.limit));
      }
    }
  }

  private consumeToken(key: string): void {
    const bucket = this.getBucket(key);
    if (bucket.tokens > 0) {
      bucket.tokens--;
    }
  }

  private getWaitTime(bucket: TokenBucket): number {
    const tokensNeeded = 1;
    const timePerToken = bucket.windowMs / bucket.limit;
    return Math.ceil(tokensNeeded * timePerToken);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}