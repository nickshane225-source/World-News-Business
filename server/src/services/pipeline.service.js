import sanitizeHtml from "sanitize-html";
import { supabase } from "../lib/supabase.js";
import { slugify, wordCount, similarity } from "../lib/text.js";
import { textModel } from "../lib/gemini.js";
import { getSettings } from "./settings.service.js";
import { researchNotes, writeArticle } from "./writer.service.js";
import { generateFeaturedImage } from "./image.service.js";

export const clean = (html) => sanitizeHtml(html, {
  allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }) },
});

async function log(kind, topic, model, ok, error, t0) {
  await supabase.from("generation_logs").insert({ kind, topic, model, ok, error: error?.slice(0, 500), duration_ms: Date.now() - t0 });
}

export async function qualityCheck(article, sources) {
  const notes = [];
  if (article.word_count < 600) notes.push(`Too short (${article.word_count} words)`);
  if (sources.length < 2) notes.push("Fewer than 2 verifiable sources");
  if (!article.meta_description || article.meta_description.length > 170) notes.push("Bad meta description length");
  if (!article.featured_image_url) notes.push("Missing featured image");
  const { data } = await supabase.from("articles").select("id,title").order("created_at", { ascending: false }).limit(300);
  if ((data || []).some((a) => a.id !== article.id && similarity(a.title, article.title) >= 0.7)) notes.push("Possible duplicate of an existing article");
  return { ok: notes.length === 0, notes: notes.join("; ") };
}

export async function createArticle({ title, keyword, angle, category, topicId }) {
  const settings = await getSettings();
  const t0 = Date.now();
  try {
    const { notes, sources } = await researchNotes({ title, keyword, angle }, settings);
    const a = await writeArticle({ title, keyword, angle, category }, notes, sources, settings);

    let slug = slugify(a.title), n = 1;
    while ((await supabase.from("articles").select("id").eq("slug", slug).maybeSingle()).data) slug = `${slugify(a.title)}-${++n}`;

    let image = null;
    if (settings.generate_images) {
      try {
        image = await generateFeaturedImage(
          { title: a.title, category: category || "Technology", keyword: a.focusKeyword || keyword, rawPrompt: a.imagePrompt },
          slug
        );
      } catch (e) {
        console.warn("Image failed:", e.message);
      }
    }

    const html = clean(a.contentHtml);
    const row = {
      title: a.title, slug, meta_title: a.metaTitle, meta_description: (a.metaDescription || "").slice(0, 165),
      focus_keyword: a.focusKeyword, secondary_keywords: a.secondaryKeywords || [], excerpt: a.excerpt,
      content_html: html, faqs: a.faqs || [], category: category || "Technology",
      featured_image_url: image, image_alt: a.imageAlt || `${a.title} (AI-generated image)`, topic_id: topicId || null, word_count: wordCount(html),
    };
    const qc = await qualityCheck(row, sources);
    const delayMins = Number(settings.publish_delay_minutes || 0);
    if (settings.mode === "auto") {
      if (delayMins > 0) {
        row.status = "SCHEDULED";
        row.scheduled_at = new Date(Date.now() + delayMins * 60 * 1000).toISOString();
        row.published_at = null;
      } else {
        row.status = "PUBLISHED";
        row.published_at = new Date().toISOString();
      }
    } else {
      row.status = "PENDING_APPROVAL";
      row.published_at = null;
    }
    row.quality_notes = qc.notes || null;

    const { data, error } = await supabase.from("articles").insert(row).select().single();
    if (error) throw error;
    if (sources.length) await supabase.from("article_sources").insert(sources.map((s) => ({ ...s, article_id: data.id })));
    await log("article", title, textModel(settings), true, null, t0);
    return data;
  } catch (e) {
    await log("article", title, textModel(settings), false, e.message, t0);
    throw e;
  }
}

export async function generateFromTopic(topicId) {
  const { data: topic, error } = await supabase.from("trending_topics").select("*").eq("id", topicId).single();
  if (error || !topic) throw error || new Error("Topic not found");
  await supabase.from("trending_topics").update({ status: "generating" }).eq("id", topicId);
  try {
    const art = await createArticle({ title: topic.title, keyword: topic.keyword, angle: topic.angle, category: topic.category, topicId });
    await supabase.from("trending_topics").update({ status: "used" }).eq("id", topicId);
    return art;
  } catch (e) {
    await supabase.from("trending_topics").update({ status: "failed" }).eq("id", topicId);
    throw e;
  }
}

export const publishArticle = async (id) =>
  supabase.from("articles").update({ status: "PUBLISHED", published_at: new Date().toISOString(), scheduled_at: null, updated_at: new Date().toISOString() }).eq("id", id).select().single();
