import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const createRedisClient = (): Redis => {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required for BullMQ later
    retryStrategy: (times) => {
      if (times > 10) {
        console.error("[Redis] Max retries reached. Giving up.");
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      console.warn(`[Redis] Retrying connection... attempt ${times}`);
      return delay;
    },
  });

  client.on("connect", () => console.log("[Redis] Connected"));
  client.on("error", (err: Error) =>
    console.error("[Redis] Error:", err.message),
  );

  return client;
};

export const redis = createRedisClient();
