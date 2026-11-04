import "./env.js";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    // If Redis is not running (e.g. on Render without a Redis instance), stop retrying after 2 attempts and use in-process queue
    if (times > 2) return null;
    return Math.min(times * 500, 1500);
  },
});

connection.on("error", () => {
  // Handled gracefully; server falls back to in-process job runner when Redis is offline
});

connection.connect().catch(() => {});
