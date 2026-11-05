import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { ai, textModel } from "../lib/gemini.js";
import { slugify, wordCount } from "../lib/text.js";
import { enqueue } from "../queues/index.js";
import { getSettings, updateSettings } from "../services/settings.service.js";
import { publishArticle, clean, qualityCheck } from "../services/pipeline.service.js";
import { generateFeaturedImageDetailed, applyPhotoCredit } from "../services/image.service.js";
import { getVisitorStats } from "../services/analytics.service.js";
import { tick } from "../workers/index.js";

const r = Router();
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(500).json({ error: e.message }));

r.get("/dashboard", wrap(async (_, res) => {
  const { data: rows } = await supabase.from("articles").select("status,created_at");
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const by = (s) => (rows || []).filter((x) => x.status === s).length;
  const settings = await getSettings();
  const { data: logs } = await supabase
    .from("generation_logs")
    .select("*")
    .in("kind", ["article", "research"])
    .order("created_at", { ascending: false })
    .limit(15);
  const { count: failures24h } = await supabase
    .from("generation_logs")
    .select("id", { count: "exact", head: true })
    .in("kind", ["article", "research"])
    .eq("ok", false)
    .gte("created_at", new Date(Date.now() - 864e5).toISOString());
  const { count: newTopics } = await supabase.from("trending_topics").select("id", { count: "exact", head: true }).eq("status", "new");
  const { count: generatingTopics } = await supabase.from("trending_topics").select("id", { count: "exact", head: true }).eq("status", "generating");
  const { data: topNewTopic } = await supabase
    .from("trending_topics")
    .select("id,title,category,score")
    .eq("status", "new")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const analytics = await getVisitorStats();

  res.json({
    total: rows?.length || 0,
    published: by("PUBLISHED"),
    approved: by("APPROVED"),
    pending: by("PENDING_APPROVAL"),
    scheduled: by("SCHEDULED"),
    drafts: by("DRAFT"),
    today: (rows || []).filter((x) => new Date(x.created_at) >= start).length,
    dailyTarget: settings.daily_target,
    automationEnabled: settings.automation_enabled,
    mode: settings.mode,
    intervalMinutes: settings.interval_minutes,
    publishDelayMinutes: settings.publish_delay_minutes,
    lastAutoRunAt: settings.last_auto_run_at,
    nextAutoRunAt: settings.next_auto_run_at,
    lastTopicDiscoveryAt: settings.last_topic_discovery_at,
    nextTopicDiscoveryAt: settings.next_topic_discovery_at,
    topNewTopic: topNewTopic || null,
    newTopics: newTopics || 0,
    generatingTopics: generatingTopics || 0,
    logs: logs || [],
    failures24h: failures24h || 0,
    analytics,
  });
}));

r.get("/settings", wrap(async (_, res) => res.json(await getSettings())));
r.put("/settings", wrap(async (req, res) => res.json(await updateSettings(req.body))));
r.post("/settings/test-connection", wrap(async (_, res) => {
  const s = await getSettings();
  const out = await ai.models.generateContent({ model: textModel(s), contents: "Reply with exactly: OK" });
  res.json({ ok: true, model: textModel(s), reply: out.text });
}));
r.post("/automation/run-now", wrap(async (_, res) => {
  const message = await tick();
  res.json({ queued: true, message });
}));

r.get("/research/topics", wrap(async (req, res) => {
  let q = supabase.from("trending_topics").select("*").order("created_at", { ascending: false }).order("score", { ascending: false }).limit(100);
  if (req.query.status) q = q.eq("status", req.query.status);
  res.json((await q).data || []);
}));
r.post("/research/discover", wrap(async (_, res) => { await enqueue("research", {}, { attempts: 1, jobId: `research-${Date.now()}` }); res.json({ queued: true }); }));
r.post("/research/topics/:id/generate", wrap(async (req, res) => {
  await supabase.from("trending_topics").update({ status: "generating" }).eq("id", req.params.id);
  await enqueue("generateTopic", { topicId: req.params.id }, { jobId: `gen-${req.params.id}-${Date.now()}` });
  res.json({ queued: true });
}));
r.post("/research/topics/:id/reject", wrap(async (req, res) => { await supabase.from("trending_topics").update({ status: "rejected" }).eq("id", req.params.id); res.json({ ok: true }); }));
r.post("/research/topics/:id/reset", wrap(async (req, res) => { await supabase.from("trending_topics").update({ status: "new" }).eq("id", req.params.id); res.json({ ok: true }); }));
r.post("/ai/generate-article", wrap(async (req, res) => {
  const { title, keyword, category } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: "Title is required" });
  await enqueue("generateManual", { title: String(title).trim(), keyword: keyword ? String(keyword).trim() : "", category: category || "Technology" }, { attempts: 3, jobId: `manual-${Date.now()}` });
  res.json({ queued: true });
}));

r.get("/articles", wrap(async (req, res) => {
  let q = supabase.from("articles").select("id,title,slug,category,status,word_count,quality_notes,scheduled_at,published_at,created_at").order("created_at", { ascending: false }).limit(200);
  if (req.query.status) q = q.eq("status", req.query.status);
  res.json((await q).data || []);
}));
r.post("/articles/publish-approved", wrap(async (req, res) => {
  const statuses = req.body?.includePending ? ["APPROVED", "PENDING_APPROVAL"] : ["APPROVED", "PENDING_APPROVAL"];
  const { data: waiting } = await supabase.from("articles").select("id").in("status", statuses);
  let count = 0;
  for (const a of waiting || []) {
    await publishArticle(a.id);
    count++;
  }
  res.json({ ok: true, published: count });
}));
r.get("/articles/:id", wrap(async (req, res) => {
  const { data, error } = await supabase.from("articles").select("*").eq("id", req.params.id).maybeSingle();
  if (error || !data) return res.status(404).json({ error: "Article not found" });
  const { data: sources } = await supabase.from("article_sources").select("title,url").eq("article_id", req.params.id);
  res.json({ ...data, sources: sources || [] });
}));
const EDITABLE = ["title", "slug", "meta_title", "meta_description", "focus_keyword", "excerpt", "content_html", "category", "featured_image_url", "image_alt", "faqs"];
r.put("/articles/:id", wrap(async (req, res) => {
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => EDITABLE.includes(k)));
  if ("title" in patch && !String(patch.title || "").trim()) {
    return res.status(400).json({ error: "Title cannot be empty" });
  }
  if ("slug" in patch) {
    const normalizedSlug = slugify(patch.slug || patch.title || "");
    if (!normalizedSlug) return res.status(400).json({ error: "Slug cannot be empty" });
    const { data: existing } = await supabase.from("articles").select("id").eq("slug", normalizedSlug).neq("id", req.params.id).maybeSingle();
    if (existing) return res.status(400).json({ error: `Slug "${normalizedSlug}" is already in use by another article` });
    patch.slug = normalizedSlug;
  }
  if ("content_html" in patch) {
    patch.content_html = clean(patch.content_html || "");
    patch.word_count = wordCount(patch.content_html);
  }
  const { data: updated, error } = await supabase.from("articles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: sources } = await supabase.from("article_sources").select("title,url").eq("article_id", req.params.id);
  const qc = await qualityCheck(updated, sources || []);
  const { data: finalData } = await supabase.from("articles").update({ quality_notes: qc.notes || null }).eq("id", req.params.id).select().single();
  res.json({ ...(finalData || updated), sources: sources || [] });
}));
r.post("/articles/:id/regenerate-image", wrap(async (req, res) => {
  const { data: art, error } = await supabase.from("articles").select("*").eq("id", req.params.id).maybeSingle();
  if (error || !art) return res.status(404).json({ error: "Article not found" });
  const img = await generateFeaturedImageDetailed(
    {
      title: art.title,
      category: art.category || "Technology",
      keyword: art.focus_keyword || "",
      rawPrompt: req.body?.prompt || "",
      excerpt: art.excerpt || "",
      contentHtml: art.content_html || "",
    },
    art.slug
  );
  if (!img?.url) return res.status(500).json({ error: "Image generation failed — check Gemini quota or try again." });
  const imageUrl = img.url;
  const alt = (img.alt || art.image_alt || art.title).slice(0, 160);
  const content_html = clean(applyPhotoCredit(art.content_html || "", img.credit));
  const { data: sources } = await supabase.from("article_sources").select("title,url").eq("article_id", req.params.id);
  const qc = await qualityCheck({ ...art, featured_image_url: imageUrl }, sources || []);
  const { data: updated } = await supabase
    .from("articles")
    .update({ featured_image_url: imageUrl, image_alt: alt, content_html, quality_notes: qc.notes || null, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  res.json({ ...updated, sources: sources || [] });
}));
r.post("/articles/:id/approve", wrap(async (req, res) => res.json((await supabase.from("articles").update({ status: "APPROVED", updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single()).data)));
r.post("/articles/:id/publish", wrap(async (req, res) => res.json((await publishArticle(req.params.id)).data)));
r.post("/articles/:id/schedule", wrap(async (req, res) => {
  const when = new Date(req.body.scheduled_at);
  if (isNaN(when)) return res.status(400).json({ error: "Invalid schedule date/time" });
  res.json((await supabase.from("articles").update({ status: "SCHEDULED", scheduled_at: when.toISOString(), updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single()).data);
}));
r.post("/articles/:id/unpublish", wrap(async (req, res) => res.json((await supabase.from("articles").update({ status: "DRAFT", published_at: null, scheduled_at: null, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single()).data)));
r.delete("/articles/:id", wrap(async (req, res) => { await supabase.from("articles").delete().eq("id", req.params.id); res.json({ ok: true }); }));

export default r;
