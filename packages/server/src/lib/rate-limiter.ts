import { redis } from "./redis.js";

const RATE_LIMIT_PREFIX = "ratelimit:generate:";
const MAX_REQUESTS_PER_DAY = 10;

const getTTLUntilEndOfDay = (): number => {
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);
  return Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
};

export const checkRateLimit = async (userId: string): Promise<void> => {
  const key = `${RATE_LIMIT_PREFIX}${userId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    // First request of the day — set expiry
    await redis.expire(key, getTTLUntilEndOfDay());
  }

  if (current > MAX_REQUESTS_PER_DAY) {
    throw new Error(
      `Daily limit of ${MAX_REQUESTS_PER_DAY} generate requests reached. Resets at midnight UTC.`,
    );
  }
};
