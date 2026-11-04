import { Queue } from "bullmq";
import { connection } from "../lib/redis.js";

export const pipeline = new Queue("pipeline", {
  connection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 30000 }, removeOnComplete: 200, removeOnFail: 500 },
});

let fallbackRunner = null;
export function setFallbackRunner(fn) {
  fallbackRunner = fn;
}

export async function enqueue(name, data = {}, opts = {}) {
  if (connection.status === "ready") {
    try {
      return await Promise.race([
        pipeline.add(name, data, opts),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis enqueue timeout")), 1500)),
      ]);
    } catch (e) {
      console.warn(`Redis enqueue failed (${e.message}), running job "${name}" in-process.`);
    }
  }
  if (fallbackRunner) {
    setImmediate(() => {
      Promise.resolve(fallbackRunner({ name, data })).catch((err) => console.error(`In-process job ${name} failed:`, err.message));
    });
    return { id: `local-${Date.now()}`, mode: "in-process" };
  }
  return { id: `queued-${Date.now()}`, mode: "deferred" };
}

// Recurring jobs: research every 3h, automation tick every 30 min, scheduled publisher every 1 min
export async function startSchedulers() {
  if (connection.status !== "ready") return;
  await pipeline.upsertJobScheduler("research-3h", { every: 3 * 60 * 60 * 1000 }, { name: "research" });
  await pipeline.upsertJobScheduler("tick-30m", { every: 30 * 60 * 1000 }, { name: "tick", opts: { attempts: 1 } });
  await pipeline.upsertJobScheduler("publish-due-1m", { every: 60 * 1000 }, { name: "publishScheduled", opts: { attempts: 1 } });
}
