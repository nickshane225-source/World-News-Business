import { supabase } from "../lib/supabase.js";
export async function getSettings() {
  const { data, error } = await supabase.from("automation_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}
const ALLOWED = ["automation_enabled", "mode", "daily_target", "active_from", "active_to", "model", "niche", "generate_images"];
export async function updateSettings(patch) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ALLOWED.includes(k)));
  if ("daily_target" in clean) {
    const n = Number(clean.daily_target);
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error("Articles / day must be a whole number between 1 and 50");
    clean.daily_target = n;
  }
  if ("active_from" in clean) {
    const n = Number(clean.active_from);
    if (!Number.isInteger(n) || n < 0 || n > 23) throw new Error("Active from hour must be between 0 and 23");
    clean.active_from = n;
  }
  if ("active_to" in clean) {
    const n = Number(clean.active_to);
    if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error("Active to hour must be between 1 and 24");
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
  const { data, error } = await supabase.from("automation_settings").update(clean).eq("id", 1).select().single();
  if (error) throw error;

  // When Automatic Post Approval Mode ('auto') is enabled, automatically approve & publish waiting articles
  if (data.mode === "auto") {
    const now = new Date().toISOString();
    await supabase
      .from("articles")
      .update({ status: "PUBLISHED", published_at: now, scheduled_at: null, updated_at: now })
      .in("status", ["APPROVED", "PENDING_APPROVAL"]);
  }

  return data;
}
