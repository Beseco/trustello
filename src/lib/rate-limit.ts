import { redis } from "@/lib/redis";

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `rl:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, "-inf", windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  if (!results) return true;

  const count = results[2]?.[1] as number | null;
  return count === null || count <= maxRequests;
}
