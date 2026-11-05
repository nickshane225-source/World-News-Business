import { supabase } from "../lib/supabase.js";

const ALLOWED = [
  "automation_enabled",
  "mode",
  "daily_target",
  "active_from",
  "active_to",
  "model",
  "niche",
  "generate_images",
];

const VALID_INTERVALS = [0, 10, 20, 30, 40, 60];
const VALID_DELAYS = [0, 10, 20, 30, 40, 60];

let cachedExtra = null;

async function getSchedulerExtra() {
  try {
    const { data } = await supabase
      .from("generation_logs")
      .select("id,topic,created_at")
      .eq("kind", "scheduler_config")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.topic) {
      const parsed = JSON.parse(data.topic);
      cachedExtra = {
        rowId: data.id,
        interval_minutes: VALID_INTERVALS.includes(Number(parsed.interval_minutes))
          ? Number(parsed.interval_minutes)
          : 20,
        publish_delay_minutes: VALID_DELAYS.includes(Number(parsed.publish_delay_minutes))
          ? Number(parsed.publish_delay_minutes)
          : 0,
        last_auto_run_at: parsed.last_auto_run_at || null,
      };
      return cachedExtra;
    }
  } catch {
    // Fallback to cached or default
  }
  if (!cachedExtra) {
    cachedExtra = {
      rowId: null,
      interval_minutes: 20,
      publish_delay_minutes: 0,
      last_auto_run_at: new Date().toISOString(),
    };
  }
  return cachedExtra;
}

export async function saveSchedulerExtra(patch = {}) {
  const current = await getSchedulerExtra();
  const next = {
    interval_minutes:
      "interval_minutes" in patch
        ? Number(patch.interval_minutes)
        : current.interval_minutes,
    publish_delay_minutes:
      "publish_delay_minutes" in patch
        ? Number(patch.publish_delay_minutes)
        : current.publish_delay_minutes,
    last_auto_run_at:
      "last_auto_run_at" in patch ? patch.last_auto_run_at : current.last_auto_run_at,
  };

  if (!VALID_INTERVALS.includes(next.interval_minutes)) {
    throw new Error("Auto-post interval must be 0, 10, 20, 30, 40, or 60 minutes");
  }
  if (!VALID_DELAYS.includes(next.publish_delay_minutes)) {
    throw new Error("Publish delay must be 0, 10, 20, 30, 40, or 60 minutes");
  }

  const payload = JSON.stringify(next);
  if (current.rowId) {
    await supabase
      .from("generation_logs")
      .update({ topic: payload, created_at: new Date().toISOString() })
      .eq("id", current.rowId);
    cachedExtra = { ...next, rowId: current.rowId };
  } else {
    const { data: inserted } = await supabase
      .from("generation_logs")
      .insert({
        kind: "scheduler_config",
        topic: payload,
        model: "scheduler",
        ok: true,
        duration_ms: 0,
      })
      .select("id")
      .single();
    cachedExtra = { ...next, rowId: inserted?.id || null };
  }
  return cachedExtra;
}

export async function getSettings() {
  const { data, error } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  const extra = await getSchedulerExtra();
  const lastRunMs = extra.last_auto_run_at ? new Date(extra.last_auto_run_at).getTime() : Date.now();
  const nextAutoRunAt =
    data.automation_enabled && extra.interval_minutes > 0
      ? new Date(lastRunMs + extra.interval_minutes * 60 * 1000).toISOString()
      : null;

  return {
    ...data,
    interval_minutes: extra.interval_minutes,
    publish_delay_minutes: extra.publish_delay_minutes,
    last_auto_run_at: extra.last_auto_run_at,
    next_auto_run_at: nextAutoRunAt,
  };
}

export async function updateSettings(patch) {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => ALLOWED.includes(k))
  );
  if ("daily_target" in clean) {
    const n = Number(clean.daily_target);
    if (!Number.isInteger(n) || n < 1 || n > 50)
      throw new Error("Articles / day must be a whole number between 1 and 50");
    clean.daily_target = n;
  }
  if ("active_from" in clean) {
    const n = Number(clean.active_from);
    if (!Number.isInteger(n) || n < 0 || n > 23)
      throw new Error("Active from hour must be between 0 and 23");
    clean.active_from = n;
  }
  if ("active_to" in clean) {
    const n = Number(clean.active_to);
    if (!Number.isInteger(n) || n < 1 || n > 24)
      throw new Error("Active to hour must be between 1 and 24");
    clean.active_to = n;
  }
  if ("active_from" in clean && "active_to" in clean && clean.active_from >= clean.active_to) {
    throw new Error("'Active from' hour must be earlier than 'Active to' hour");
  }
  if ("model" in clean) {
    clean.model = String(clean.model || "").trim();
    if (!clean.model) throw new Error("Model name cannot be empty");
  }
  if ("niche" in clean) {
    clean.niche = String(clean.niche || "").trim();
    if (!clean.niche) throw new Error("Niche cannot be empty");
  }

  let data;
  if (Object.keys(clean).length > 0) {
    const res = await supabase
      .from("automation_settings")
      .update(clean)
      .eq("id", 1)
      .select()
      .single();
    if (res.error) throw res.error;
    data = res.data;
  } else {
    const res = await supabase
      .from("automation_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (res.error) throw res.error;
    data = res.data;
  }

  const extraPatch = {};
  if ("interval_minutes" in patch) {
    extraPatch.interval_minutes = Number(patch.interval_minutes);
    // Reset countdown timer from now when interval changes
    extraPatch.last_auto_run_at = new Date().toISOString();
  }
  if ("publish_delay_minutes" in patch) {
    extraPatch.publish_delay_minutes = Number(patch.publish_delay_minutes);
  }
  if ("last_auto_run_at" in patch) {
    extraPatch.last_auto_run_at = patch.last_auto_run_at;
  }

  const extra =
    Object.keys(extraPatch).length > 0
      ? await saveSchedulerExtra(extraPatch)
      : await getSchedulerExtra();

  // When Automatic Post Approval Mode ('auto') is enabled and delay is 0, automatically approve & publish waiting articles
  if (data.mode === "auto" && extra.publish_delay_minutes === 0) {
    const now = new Date().toISOString();
    await supabase
      .from("articles")
      .update({ status: "PUBLISHED", published_at: now, scheduled_at: null, updated_at: now })
      .in("status", ["APPROVED", "PENDING_APPROVAL"]);
  }

  const lastRunMs = extra.last_auto_run_at ? new Date(extra.last_auto_run_at).getTime() : Date.now();
  const nextAutoRunAt =
    data.automation_enabled && extra.interval_minutes > 0
      ? new Date(lastRunMs + extra.interval_minutes * 60 * 1000).toISOString()
      : null;

  return {
    ...data,
    interval_minutes: extra.interval_minutes,
    publish_delay_minutes: extra.publish_delay_minutes,
    last_auto_run_at: extra.last_auto_run_at,
    next_auto_run_at: nextAutoRunAt,
  };
}
