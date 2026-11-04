import { Worker } from "bullmq";
import { connection } from "../lib/redis.js";
import { supabase } from "../lib/supabase.js";
import { enqueue, setFallbackRunner } from "../queues/index.js";
import { getSettings } from "../services/settings.service.js";
import { discoverTopics } from "../services/research.service.js";
import { createArticle, generateFromTopic, publishArticle } from "../services/pipeline.service.js";

export async function publishScheduled() {
  const { data: due } = await supabase.from("articles").select("id").eq("status", "SCHEDULED").lte("scheduled_at", new Date().toISOString());
  let count = 0;
  for (const a of due || []) {
    await publishArticle(a.id);
    count++;
  }
  return count;
}

export async function tick() {
  // 1) Always publish due scheduled articles regardless of automation_enabled
  const publishedDue = await publishScheduled();
  const s = await getSettings();

  // 2) In auto mode, automatically approve & publish any PENDING_APPROVAL or APPROVED articles waiting in the queue
  let publishedApproved = 0;
  if (s.mode === "auto") {
    const { data: waiting } = await supabase.from("articles").select("id").in("status", ["APPROVED", "PENDING_APPROVAL"]);
    for (const a of waiting || []) {
      await publishArticle(a.id);
      publishedApproved++;
    }
  }

  if (!s.automation_enabled) {
    const totalAuto = publishedDue + publishedApproved;
    return totalAuto > 0
      ? `Published ${totalAuto} waiting/scheduled article(s). Automation is disabled — enable it in Settings to auto-generate new articles.`
      : "Automation is disabled — enable 'Enable automatic research & article writing' and Save settings first.";
  }

  // 3) Generate toward the daily target (only inside active hours)
  const hour = new Date().getHours();
  if (hour < s.active_from || hour >= s.active_to) {
    return `Outside active hours (current server hour: ${hour}:00, active window: ${s.active_from}:00–${s.active_to}:00).`;
  }
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("articles").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
  const remaining = s.daily_target - (count || 0);
  if (remaining <= 0) {
    return `Daily target already reached (${count || 0}/${s.daily_target} articles generated today).`;
  }

  const slots = Math.max(1, (s.active_to - hour) * 2); // ticks left today
  const batch = Math.min(remaining, Math.max(1, Math.ceil(remaining / slots)));
  const { data: topics } = await supabase.from("trending_topics").select("id").eq("status", "new").order("score", { ascending: false }).limit(batch);
  if (!topics?.length) {
    await enqueue("research", {}, { jobId: `research-${Date.now()}` });
    return "No unused trending topics available — queued a new topic discovery job.";
  }
  for (const t of topics) await enqueue("generateTopic", { topicId: t.id }, { jobId: `gen-${t.id}-${Date.now()}` });
  const extra = (publishedDue + publishedApproved) > 0 ? ` (also published ${publishedDue + publishedApproved} article(s))` : "";
  return `Queued ${topics.length} topic(s) for article generation${extra}.`;
}

async function runJob(job) {
  switch (job.name) {
    case "tick": return tick();
    case "publishScheduled": return publishScheduled();
    case "research": return discoverTopics(await getSettings());
    case "generateTopic": return generateFromTopic(job.data.topicId);
    case "generateManual": return createArticle(job.data);
    default: throw new Error(`Unknown job ${job.name}`);
  }
}

setFallbackRunner(runJob);

export function startWorker() {
  // Recover any topics left stuck in 'generating' if server restarted mid-job
  supabase.from("trending_topics").update({ status: "failed" }).eq("status", "generating").then(() => {}).catch(() => {});

  // Always check due scheduled articles every 60s even if Redis is offline
  setInterval(() => publishScheduled().catch(() => {}), 60 * 1000).unref();

  if (connection.status === "ready") {
    const worker = new Worker("pipeline", runJob, { connection, concurrency: 2 });
    worker.on("error", () => {});
    worker.on("failed", async (job, err) => {
      console.error(`Job ${job?.name} failed:`, err.message);
      if (job?.name === "generateTopic" && job.data?.topicId)
        await supabase.from("trending_topics").update({ status: "failed" }).eq("id", job.data.topicId);
    });
    console.log("Worker started (Redis BullMQ)");
    return worker;
  }

  connection.once("ready", () => {
    const worker = new Worker("pipeline", runJob, { connection, concurrency: 2 });
    worker.on("error", () => {});
    worker.on("failed", async (job, err) => {
      console.error(`Job ${job?.name} failed:`, err.message);
      if (job?.name === "generateTopic" && job.data?.topicId)
        await supabase.from("trending_topics").update({ status: "failed" }).eq("id", job.data.topicId);
    });
    console.log("Worker attached to Redis BullMQ");
  });

  console.log("Worker started (in-process fallback active)");
  return null;
}
