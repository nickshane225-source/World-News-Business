import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { ai, textModel } from "../lib/gemini.js";
import { supabase } from "../lib/supabase.js";

/**
 * Editorial Newsroom Real-Photo Pipeline:
 *  1) Gemini plans a realistic, human-understandable photograph scene & 4 photojournalist search terms.
 *  2) Tries native Gemini Photorealistic Generation (if available on the project plan).
 *  3) High-Resolution Real Editorial Photography from Wikimedia Commons & Openverse:
 *     - Fetches authentic, high-resolution (1000px+) real-world photographs taken by camera.
 *     - Filters out diagrams, charts, cartoons, maps, logos, flags, vintage b&w scans, and documents.
 *     - Gemini Vision analyzes and verifies candidate photos against the article topic, ensuring
 *       it looks like an authentic, high-quality, professional press photograph that humans understand.
 *     - Automatically crops and optimizes to 1600x900 (16:9) WebP with attention-guided smart framing.
 *     - Provides full editorial attribution / photo credit with link.
 *  4) Fallback: Gemini vector scene synthesis if external connectivity is interrupted.
 */

const REAL_PEOPLE =
  /\b(Biden|Trump|Harris|Vance|Musk|Altman|Zuckerberg|Cook|Nadella|Pichai|Bezos|Huang|Putin|Zelensky|Netanyahu|Xi Jinping|Modi|Obama|Pelosi|Schumer|McConnell)\b/gi;
const GRAPHIC = /\b(crash|explosion|shooting|casualties|victim|blood|death|corpse|wounded)\b/gi;

const IMAGE_MODELS = () =>
  [
    (process.env.GEMINI_IMAGE_MODEL || "").trim(),
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    "gemini-2.5-flash-image",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

const BAD_PHOTO_WORDS =
  /\b(dalle|dall·e|midjourney|stable diffusion|ai generated|ai art|vintage|antique|newspaper|advert|advertising|clipping|plaque|gravestone|cemetery|meme|screenshot|diagram|chart|graph|map|logo|icon|cartoon|drawing|sketch|illustration|render|stamp|coin|document|poster|flyer|postcard|museum|archive|scan|1[89]\d\d|18\d\d|19\d\d)\b/i;

const WIKIMEDIA_USER_AGENT = "WorldNewsPortal/1.0 (https://worldnews.business; contact@worldnews.business) Mozilla/5.0";

// Used when Gemini cannot plan the scene (e.g. daily quota reached)
const CATEGORY_QUERIES = {
  ai: ["server racks data center", "computer programmer office", "robotics engineering laboratory"],
  technology: ["software developer laptop", "server racks datacenter", "smartphone user modern"],
  business: ["business corporate meeting", "stock exchange traders", "modern office workers"],
  politics: ["united states capitol building", "government press room", "election polling station"],
  science: ["laboratory scientist microscope", "scientific research cleanroom", "medical laboratory"],
  health: ["modern pharmacy medicine", "hospital doctor clinic", "pharmaceutical medicine bottles"],
  culture: ["concert crowd stage", "video game controller console", "movie cinema theater"],
  world: ["modern city street skyline", "international summit flags", "modern airport terminal"],
  finance: ["stock exchange trading floor", "financial district skyline", "banking office corporate"],
};

let imageQuotaCooldownUntil = 0;

const sanitizeSubject = (s = "") =>
  String(s).replace(REAL_PEOPLE, "a government official").replace(GRAPHIC, "emergency response");

const stripHtml = (html = "") =>
  String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function parseJson(text, fallback) {
  const m = String(text || "").match(/[\[{][\s\S]*[\]}]/);
  if (!m) return fallback;
  try {
    return JSON.parse(m[0]);
  } catch {
    return fallback;
  }
}

/**
 * Builds a prompt for Gemini native image generation demanding real photojournalism style.
 */
export function buildEditorialImagePrompt({ title = "", category = "Technology", keyword = "", rawPrompt = "", scene = "" }, attempt = 1) {
  const subject = sanitizeSubject(scene || rawPrompt || `${title} (${keyword || category})`);
  if (attempt === 1) {
    return `Authentic editorial news photograph for a ${category} story. Scene: ${subject}.
Shot by a professional Reuters/AP photojournalist on a full-frame DSLR (35mm lens, f/2.8), natural available light, true-to-life colors, realistic skin texture and fabric detail, real-world location, candid documentary moment, subtle film grain, shallow depth of field, landscape 16:9 composition.
It must look like a real camera photo, not CGI, not a 3D render, not an illustration, not neon sci-fi.
People shown must be anonymous ordinary people (workers, professionals, citizens), never recognizable celebrities or politicians.
Absolutely no text overlays, captions, readable signs, logos, brand names, or watermarks.`;
  }
  return `Realistic documentary photograph, 16:9 landscape: ${subject}. Natural daylight, real location, candid moment, photojournalism style, DSLR 35mm. Not CGI, not illustration. No text, no logos, no watermarks, no famous people.`;
}

/**
 * Converts a raw image buffer into:
 * 1) 1600x900 (16:9) WebP (86% quality) with attention-guided framing
 * 2) 600x338 (16:9) WebP thumbnail (82% quality)
 * Uploads both to Supabase Storage "media" bucket.
 */
export async function processAndUploadImage(inputBuffer, slug) {
  const ts = Date.now();
  const safeSlug = (slug || "article").replace(/[^a-z0-9-]/gi, "-").slice(0, 80);
  const fullPath = `${safeSlug}-${ts}.webp`;
  const thumbPath = `${safeSlug}-${ts}-thumb.webp`;

  const [fullBuf, thumbBuf] = await Promise.all([
    sharp(inputBuffer)
      .rotate()
      .resize(1600, 900, { fit: "cover", position: "attention", kernel: "lanczos3" })
      .sharpen({ sigma: 0.6 })
      .webp({ quality: 86 })
      .toBuffer(),
    sharp(inputBuffer)
      .rotate()
      .resize(600, 338, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer(),
  ]);

  const { error: errFull } = await supabase.storage
    .from("media")
    .upload(fullPath, fullBuf, { contentType: "image/webp", upsert: true });
  if (errFull) throw errFull;

  const { error: errThumb } = await supabase.storage
    .from("media")
    .upload(thumbPath, thumbBuf, { contentType: "image/webp", upsert: true });
  if (errThumb) console.warn("[Image] Thumbnail upload warning:", errThumb.message);

  const url = supabase.storage.from("media").getPublicUrl(fullPath).data.publicUrl;
  const thumbUrl = supabase.storage.from("media").getPublicUrl(thumbPath).data.publicUrl;
  return { url, thumbUrl };
}

/**
 * Step 1: Gemini reads the article and plans what a real news photograph of this story should show.
 */
export async function planArticleVisual(meta = {}) {
  const { title = "", excerpt = "", contentHtml = "", category = "Technology", keyword = "", rawPrompt = "", model } = meta;
  const body = stripHtml(contentHtml).slice(0, 1500);
  const catQueries = CATEGORY_QUERIES[String(category).toLowerCase()] || CATEGORY_QUERIES.technology;
  const fallback = {
    scene: rawPrompt || `${keyword || category} in a real-world setting related to: ${title}`,
    alt: `Photo illustrating: ${title}`.slice(0, 120),
    queries: [keyword, ...catQueries].filter(Boolean).slice(0, 4),
  };
  try {
    const res = await ai.models.generateContent({
      model: textModel(model ? { model } : undefined),
      contents: `You are the chief photo editor of a major US publication (Reuters / AP / Bloomberg). Read this article and decide which REAL photograph a human reader would instantly understand and connect with the story.

Headline: "${title}"
Category: ${category}
Focus keyword: ${keyword}
Summary: ${excerpt}
Article text: ${body}
${rawPrompt ? `Writer's image idea: ${rawPrompt}` : ""}

Return ONLY JSON with:
- "scene": 1-2 sentences describing one concrete, realistic, camera-photographable real-world scene matching the story (e.g. "a modern pharmacy prescription counter with medicine bottles", "rows of server racks in a data center with indicator lights", "a financial analyst working on multiple trading monitors"). No real named celebrities/politicians, no gore, no text overlays.
- "alt": accessible alt text for that photo (under 120 characters).
- "queries": 4 short search terms (2-3 words each) to find a real photograph in photo archives (e.g. ["pharmacy counter", "prescription medicines", "server racks", "datacenter"]). Avoid abstract buzzwords or rare corporate names.`,
    });
    const parsed = parseJson(res.text, null);
    if (parsed && typeof parsed.scene === "string" && Array.isArray(parsed.queries) && parsed.queries.length) {
      return {
        scene: sanitizeSubject(parsed.scene).slice(0, 600),
        alt: String(parsed.alt || fallback.alt).slice(0, 120),
        queries: parsed.queries.map(String).filter(Boolean).slice(0, 4),
      };
    }
  } catch (e) {
    console.warn("[Image] Visual planning fallback to defaults:", (e.message || "").slice(0, 100));
  }
  return fallback;
}

/**
 * Step 2: Try native Gemini photorealistic image generation if active and within quota.
 */
async function generateWithGeminiImageModel(meta) {
  if (!process.env.GEMINI_API_KEY) return null;
  if (Date.now() < imageQuotaCooldownUntil) return null;

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = IMAGE_MODELS();
  let quotaFailures = 0;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: buildEditorialImagePrompt(meta, attempt),
          config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9" } },
        });
        const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (part) return { buffer: Buffer.from(part.inlineData.data, "base64"), model };
      } catch (err) {
        const msg = err.message || "";
        if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) { quotaFailures++; break; }
        if (/404|not found/i.test(msg)) break;
      }
    }
  }
  if (quotaFailures === models.length) {
    imageQuotaCooldownUntil = Date.now() + 30 * 60 * 1000;
  }
  return null;
}

/**
 * Search Wikimedia Commons for real, high-resolution editorial photographs.
 */
async function searchWikimediaPhotos(queries = []) {
  const candidates = [];
  const seenUrls = new Set();

  for (const q of queries.slice(0, 4)) {
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${q}`)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|dimensions|mime|extmetadata&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      for (const p of pages) {
        const info = p.imageinfo?.[0];
        if (!info?.url || seenUrls.has(info.url)) continue;
        if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(info.mime)) continue;
        if ((info.width || 0) < 900 || (info.height || 0) < 500) continue;
        if (info.width < info.height) continue; // Landscape preferred

        const title = String(p.title || "").replace(/^File:/i, "");
        if (BAD_PHOTO_WORDS.test(title)) continue;

        seenUrls.add(info.url);
        const meta = info.extmetadata || {};
        const artistRaw = meta.Artist?.value || meta.Credit?.value || "Wikimedia Contributor";
        const artist = stripHtml(artistRaw).slice(0, 60) || "Wikimedia Contributor";
        const lic = meta.LicenseShortName?.value || meta.UsageTerms?.value || "Creative Commons";

        candidates.push({
          title: title.slice(0, 100),
          url: info.url,
          width: info.width,
          height: info.height,
          creator: artist,
          license: lic,
          landingUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || "")}`,
          provider: "Wikimedia Commons",
        });
      }
      if (candidates.length >= 10) break;
    } catch {}
  }
  return candidates;
}

/**
 * Search Openverse (Flickr / CC archives) with graceful fallback.
 */
async function searchOpenversePhotos(queries = []) {
  const candidates = [];
  const seenUrls = new Set();

  for (const q of queries.slice(0, 3)) {
    try {
      const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&aspect_ratio=wide&page_size=10`;
      const res = await fetch(url, {
        headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.results || []) {
        if (!item?.url || seenUrls.has(item.url)) continue;
        if ((item.width || 0) < 800 || (item.height || 0) < 450 || item.width < item.height) continue;
        const title = String(item.title || "");
        const tags = (item.tags || []).map((t) => t.name).join(" ");
        if (BAD_PHOTO_WORDS.test(title) || BAD_PHOTO_WORDS.test(tags)) continue;
        seenUrls.add(item.url);
        candidates.push({
          title: title.slice(0, 100),
          url: item.url,
          width: item.width,
          height: item.height,
          creator: item.creator || "Photographer",
          license: item.license || "CC",
          landingUrl: item.foreign_landing_url || item.url,
          provider: item.provider || item.source || "Flickr / Openverse",
        });
      }
    } catch {}
  }
  return candidates;
}

/**
 * Unified real-photo candidate search.
 */
export async function searchRealPhotos(queries = []) {
  const [wiki, ov] = await Promise.all([
    searchWikimediaPhotos(queries),
    searchOpenversePhotos(queries),
  ]);
  return [...wiki, ...ov];
}

/**
 * Gemini Vision evaluation: verifies that the photograph is high-quality, modern,
 * authentic (not a chart/diagram/document/cartoon), and clearly connected to the news story.
 */
async function pickBestPhotoWithVision(items, meta, plan) {
  const parts = [];
  for (let i = 0; i < items.length; i++) {
    const preview = await sharp(items[i].buffer)
      .resize(640, 360, { fit: "cover", position: "attention" })
      .jpeg({ quality: 72 })
      .toBuffer();
    parts.push({ text: `Image candidate ${i}:` });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: preview.toString("base64") } });
  }
  parts.push({
    text: `You are the photo editor of a major US news publication. Pick the BEST featured photograph for this article:
Headline: "${meta.title}"
Category: "${meta.category}"
Topic & Summary: "${meta.excerpt || meta.title}"

Criteria for approval:
1. Real camera photography (modern color photograph, clear resolution, professional composition).
2. Human-understandable and clearly related to the TOPIC (e.g. servers/hardware for tech/data centers, pharmacy/medicines for health, congress/capitol for politics, trading floor for business).
3. Strictly REJECT any diagrams, charts, cartoons, drawings, scanned papers/documents, logos, or vintage black-and-white photos.

Select the index (0 to ${items.length - 1}) of the best candidate, or -1 if none are acceptable.
Reply ONLY with JSON: {"index": number, "score": 0-10, "reason": "brief reason"}`,
  });

  const res = await ai.models.generateContent({
    model: textModel(meta.model ? { model: meta.model } : undefined),
    contents: [{ role: "user", parts }],
  });
  return parseJson(res.text, { index: -1, score: 0, reason: "unparseable" });
}

function keywordScore(c, meta, plan) {
  const words = `${plan.queries.join(" ")} ${meta.keyword || ""} ${meta.category || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  const hay = `${c.title} ${c.url}`.toLowerCase();
  let s = 0;
  for (const w of new Set(words)) if (hay.includes(w)) s += 1;
  if (/^(img|dsc|p\d|_mg|untitled|no\.)/i.test(c.title)) s -= 1;
  if (c.width >= 1200) s += 0.5;
  return s;
}

/**
 * Step 3: Fetch, verify, and crop a real, high-resolution editorial photograph.
 */
async function findVerifiedRealPhoto(meta, plan) {
  const candidates = await searchRealPhotos(plan.queries);
  if (!candidates.length) return null;

  const ordered = candidates
    .map((c) => ({ c, s: keywordScore(c, meta, plan) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);

  const items = [];
  for (const cand of ordered.slice(0, 8)) {
    if (items.length >= 4) break;
    try {
      const res = await fetch(cand.url, {
        headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      await sharp(buffer).metadata(); // Verify decodable image
      items.push({ buffer, candidate: cand });
    } catch {}
  }
  if (!items.length) return null;

  // Verify candidates with Gemini Vision
  try {
    const verdict = await pickBestPhotoWithVision(items, meta, plan);
    const idx = Number(verdict.index);
    if (Number.isInteger(idx) && idx >= 0 && items[idx] && Number(verdict.score ?? 7) >= 5) {
      console.log(`[Image] Vision approved real photo "${items[idx].candidate.title}" (score: ${verdict.score}): ${verdict.reason || ""}`);
      return { ...items[idx], verdict: { approved: true, ...verdict } };
    }
  } catch (e) {
    console.warn(`[Image] Vision check unavailable (${(e.message || "").slice(0, 60)}); falling back to top relevant photo`);
  }

  // Graceful fallback to the highest-scoring candidate if Vision is rate-limited
  const top = items[0];
  if (top && keywordScore(top.candidate, meta, plan) >= 0) {
    console.log(`[Image] Using top editorial photo candidate: "${top.candidate.title}"`);
    return { ...top, verdict: { approved: true, reason: "top relevant photojournalism match" } };
  }

  return null;
}

export function buildPhotoCredit(c) {
  if (!c) return null;
  const author = escapeHtml(c.creator || "Editorial Photo");
  const title = escapeHtml(c.title || "Photo");
  const provider = escapeHtml(c.provider || "Commons");
  const lic = escapeHtml(c.license || "CC");
  return {
    text: `Photo: "${title}" by ${author} via ${provider} (${lic})`,
    html: `<p><em>Featured photo: <a href="${c.landingUrl}" target="_blank" rel="noopener noreferrer">${title}</a> / ${author} via ${provider} (${lic}).</em></p>`,
  };
}

const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CREDIT_RE = /<p><em>Featured photo:[\s\S]*?<\/em><\/p>/gi;

export function applyPhotoCredit(contentHtml = "", credit) {
  const base = String(contentHtml || "").replace(CREDIT_RE, "").trim();
  return credit?.html ? `${base}\n${credit.html}` : base;
}

/**
 * Last-resort fallback: abstract vector SVG scene if external photo services are offline.
 */
async function generateGeminiSceneSvgBuffer({ title, category, keyword }) {
  const res = await ai.models.generateContent({
    model: textModel(),
    contents: `Create a rich, atmospheric 1600x900 widescreen SVG artwork (viewBox="0 0 1600 900") symbolizing this news topic:
Title: "${title}"
Category: "${category}"
Keyword: "${keyword}"
Return ONLY raw valid <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">...</svg> code. Use gradients, filters, layered silhouettes. Strictly NO <text>, letters, logos, or faces.`,
  });
  const match = (res.text || "").match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new Error("Gemini did not return valid SVG scene markup");
  return Buffer.from(match[0].replace(/<text[\s\S]*?<\/text>/gi, ""), "utf8");
}

/**
 * Full Pipeline: Generates a realistic, human-understandable featured photograph.
 * Returns { url, alt, credit, source, scene } or null.
 */
export async function generateFeaturedImageDetailed(promptOrMeta, slug) {
  const meta =
    typeof promptOrMeta === "string"
      ? { rawPrompt: promptOrMeta, title: slug, category: "Technology", keyword: "" }
      : { category: "Technology", ...(promptOrMeta || {}) };

  const plan = await planArticleVisual(meta);
  console.log(`[Image] Planned editorial visual for "${meta.title}": ${plan.scene}`);

  // 1) Photorealistic AI generation (if user has enabled it with Gemini image quota)
  const gen = await generateWithGeminiImageModel({ ...meta, scene: plan.scene });
  if (gen) {
    const { url } = await processAndUploadImage(gen.buffer, slug);
    return { url, alt: plan.alt, credit: null, source: "gemini-photo", model: gen.model, scene: plan.scene };
  }

  // 2) High-Resolution Real Editorial Photography (Wikimedia Commons + Openverse verified with Vision)
  try {
    const real = await findVerifiedRealPhoto(meta, plan);
    if (real) {
      const { url } = await processAndUploadImage(real.buffer, slug);
      return {
        url,
        alt: plan.alt,
        credit: buildPhotoCredit(real.candidate),
        source: "real-photo",
        scene: plan.scene,
        verdict: real.verdict,
      };
    }
  } catch (e) {
    console.warn("[Image] Real photo search warning:", (e.message || "").slice(0, 120));
  }

  // 3) Abstract SVG fallback (last resort if all external image sources fail)
  try {
    const svgBuf = await generateGeminiSceneSvgBuffer(meta);
    const { url } = await processAndUploadImage(svgBuf, slug);
    return { url, alt: plan.alt, credit: null, source: "svg-fallback", scene: plan.scene };
  } catch (err) {
    console.warn("[Image] SVG fallback failed:", err.message);
    return null;
  }
}

export async function generateFeaturedImage(promptOrMeta, slug) {
  const r = await generateFeaturedImageDetailed(promptOrMeta, slug);
  return r?.url || null;
}
