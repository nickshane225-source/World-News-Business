import { Router } from "express";
import { supabase } from "../lib/supabase.js";
const r = Router();
const LIST = "id,title,slug,excerpt,category,featured_image_url,image_alt,published_at";

r.get("/articles", async (req, res) => {
  const page = Math.max(1, +req.query.page || 1), size = 12;
  let q = supabase.from("articles").select(LIST, { count: "exact" }).eq("status", "PUBLISHED").order("published_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (req.query.category) q = q.eq("category", req.query.category);
  const { data, count, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ articles: data, total: count, page, pages: Math.ceil(count / size) });
});

r.get("/articles/:slug", async (req, res) => {
  const { data } = await supabase.from("articles").select("*").eq("slug", req.params.slug).eq("status", "PUBLISHED").maybeSingle();
  if (!data) return res.status(404).json({ error: "Not found" });
  const { data: sources } = await supabase.from("article_sources").select("title,url").eq("article_id", data.id);
  const { quality_notes, topic_id, ...pub } = data;
  res.json({ ...pub, sources: sources || [] });
});

r.get("/categories", async (_, res) => {
  const { data } = await supabase.from("articles").select("category").eq("status", "PUBLISHED");
  res.json([...new Set((data || []).map((d) => d.category).filter(Boolean))]);
});

export async function sitemap(_, res) {
  const site = (process.env.SITE_URL || "https://worldnews.business").replace(/\/$/, "");
  const { data } = await supabase.from("articles").select("slug,published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(5000);
  const urls = [`<url><loc>${site}/</loc></url>`, `<url><loc>${site}/about</loc></url>`, ...(data || []).map((a) => `<url><loc>${site}/a/${a.slug}</loc><lastmod>${new Date(a.published_at).toISOString()}</lastmod></url>`)];
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
}
export default r;
