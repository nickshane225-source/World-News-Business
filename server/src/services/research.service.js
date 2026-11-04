import { XMLParser } from "fast-xml-parser";
import { Type } from "@google/genai";
import { ai, textModel } from "../lib/gemini.js";
import { supabase } from "../lib/supabase.js";
import { similarity } from "../lib/text.js";

const parser = new XMLParser({ ignoreAttributes: true, processEntities: false });
const FEEDS = ["TECHNOLOGY", "NATION", "BUSINESS", "SCIENCE"].map(
  (t) => `https://news.google.com/rss/headlines/section/topic/${t}?hl=en-US&gl=US&ceid=US:en`
);

async function rss(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const items = parser.parse(await r.text())?.rss?.channel?.item || [];
    return (Array.isArray(items) ? items : [items]).slice(0, 15).map((i) => ({ title: String(i.title), source: "google-news" }));
  } catch { return []; }
}
async function reddit() {
  try {
    const r = await fetch("https://www.reddit.com/r/technology/top.json?t=day&limit=15", {
      headers: { "User-Agent": "ai-publisher-pro/1.0" }, signal: AbortSignal.timeout(10000),
    });
    return (await r.json()).data.children.map((c) => ({ title: c.data.title, source: "reddit" }));
  } catch { return []; }
}

export async function discoverTopics(settings) {
  const t0 = Date.now();
  try {
    const signals = (await Promise.all([...FEEDS.map(rss), reddit()])).flat();
    if (!signals.length) throw new Error("No trend signals could be fetched (network/feeds blocked?)");

    const res = await ai.models.generateContent({
      model: textModel(settings),
      contents: `You are the editor of a US news & technology blog. Niche: ${settings.niche}.
From these real headlines, pick up to 20 distinct, high-interest story angles for US readers.
Merge duplicates about the same story. Skip celebrity gossip, unverified rumors and anything unsafe.
For each, write an ORIGINAL working title (not a copied headline), a focus keyword, a one-sentence angle,
a category (Technology, AI, Business, Politics, Science, Culture or Health) and a score 0-100
(relevance + freshness + search potential).

HEADLINES:
${signals.map((s, i) => `${i + 1}. [${s.source}] ${s.title}`).join("\n")}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING }, keyword: { type: Type.STRING }, angle: { type: Type.STRING },
              category: { type: Type.STRING }, score: { type: Type.INTEGER },
            },
            required: ["title", "keyword", "angle", "category", "score"],
          },
        },
      },
    });

    const found = JSON.parse(res.text);
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("trending_topics").select("title").order("created_at", { ascending: false }).limit(400),
      supabase.from("articles").select("title").order("created_at", { ascending: false }).limit(400),
    ]);
    const existing = [...(t || []), ...(a || [])].map((x) => x.title);
    const fresh = [];
    for (const f of found) {
      if ([...existing, ...fresh.map((x) => x.title)].some((e) => similarity(e, f.title) > 0.6)) continue;
      fresh.push({ ...f, source: "gemini+news" });
    }
    if (fresh.length) await supabase.from("trending_topics").insert(fresh);
    await supabase.from("generation_logs").insert({
      kind: "research",
      topic: `Discovered ${fresh.length} new topic(s)`,
      model: textModel(settings),
      ok: true,
      error: null,
      duration_ms: Date.now() - t0,
    });
    return fresh.length;
  } catch (e) {
    await supabase.from("generation_logs").insert({
      kind: "research",
      topic: "Discover trending topics",
      model: textModel(settings),
      ok: false,
      error: e.message?.slice(0, 500),
      duration_ms: Date.now() - t0,
    });
    throw e;
  }
}
