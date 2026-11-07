import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { recordVisit } from "../services/analytics.service.js";
const r = Router();
const LIST = "id,title,slug,excerpt,category,featured_image_url,image_alt,published_at";

r.post("/track", async (req, res) => {
  try {
    const out = await recordVisit(req, req.body || {});
    res.json(out);
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message });
  }
});

r.get("/articles", async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const size = 12;
    let q = supabase.from("articles").select(LIST, { count: "exact" }).eq("status", "PUBLISHED").order("published_at", { ascending: false }).range((page - 1) * size, page * size - 1);
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      q = q.eq("category", req.query.category.trim());
    }
    const { data, count, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const totalCount = count || 0;
    res.json({ articles: data || [], total: totalCount, page, pages: Math.ceil(totalCount / size) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.get("/articles/:slug", async (req, res) => {
  try {
    if (!req.params.slug || typeof req.params.slug !== "string") {
      return res.status(400).json({ error: "Invalid slug" });
    }
    const { data, error } = await supabase.from("articles").select("*").eq("slug", req.params.slug).eq("status", "PUBLISHED").maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    const { data: sources } = await supabase.from("article_sources").select("title,url").eq("article_id", data.id);
    const { quality_notes, topic_id, ...pub } = data;
    res.json({ ...pub, sources: sources || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.get("/categories", async (_, res) => {
  try {
    const { data, error } = await supabase.from("articles").select("category").eq("status", "PUBLISHED");
    if (error) return res.status(500).json({ error: error.message });
    res.json([...new Set((data || []).map((d) => d.category).filter(Boolean))]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export async function sitemap(_, res) {
  try {
    const site = (process.env.SITE_URL || "https://worldnews.business").replace(/\/$/, "");
    const { data, error } = await supabase.from("articles").select("slug,published_at").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(5000);
    if (error) return res.status(500).send("Error generating sitemap");
    const urls = [
      `<url><loc>${site}/</loc></url>`,
      `<url><loc>${site}/about</loc></url>`,
      ...(data || []).map((a) => {
        const lastmod = a.published_at && !isNaN(new Date(a.published_at).getTime())
          ? `<lastmod>${new Date(a.published_at).toISOString()}</lastmod>`
          : "";
        return `<url><loc>${site}/a/${a.slug}</loc>${lastmod}</url>`;
      }),
    ];
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  } catch (e) {
    res.status(500).send("Error generating sitemap");
  }
}
export default r;
