import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { ai, textModel } from "../lib/gemini.js";
import { supabase } from "../lib/supabase.js";

/**
 * Sanitizes an image prompt to enforce editorial safety rules:
 * - Never depict real identifiable people (politicians, celebrities, executives)
 * - Never fabricate photos of specific real-world disasters/events
 * - Focus on symbolic objects, architecture, environments, or technology hardware
 */
export function buildEditorialImagePrompt({ title = "", category = "Technology", keyword = "", rawPrompt = "" }, attempt = 1) {
  const baseSubject = rawPrompt || `${title} (${keyword || category})`;
  const safeSubject = baseSubject
    .replace(/\b(Biden|Trump|Harris|Musk|Altman|Zuckerberg|Cook|Nadella|Pichai|Putin|Zelensky|Netanyahu)\b/gi, "industry leadership")
    .replace(/\b(crash|explosion|shooting|casualties|victim|blood|death)\b/gi, "emergency response infrastructure");

  if (attempt === 1) {
    return `Photorealistic editorial news photography representing: ${safeSubject}. Category: ${category}. Focus on symbolic environment, architectural space, hardware, or laboratory/urban scene. Natural lighting, realistic surface textures, shallow depth of field, 35mm photojournalism lens, sharp 16:9 widescreen composition. Strictly NO text, NO words, NO numbers, NO logos, NO watermarks, and NO identifiable real people or faces.`;
  }
  return `High-definition 16:9 editorial still-life and architectural photography symbolizing ${category} and ${keyword || "modern technology infrastructure"}. Natural daylight, cinematic depth, realistic materials (brushed metal, optical glass, fiber optics, architectural concrete). Strictly NO people, NO faces, NO text, NO logos, NO watermarks.`;
}

/**
 * Converts a raw image buffer into:
 * 1) 1600x900 (16:9) WebP at 85% quality
 * 2) 600x338 (16:9) WebP thumbnail at 82% quality
 * Uploads both to the Supabase "media" bucket and returns { url, thumbUrl }.
 */
export async function processAndUploadImage(inputBuffer, slug) {
  const ts = Date.now();
  const safeSlug = (slug || "article").replace(/[^a-z0-9-]/gi, "-").slice(0, 80);
  const fullPath = `${safeSlug}-${ts}.webp`;
  const thumbPath = `${safeSlug}-${ts}-thumb.webp`;

  const [fullBuf, thumbBuf] = await Promise.all([
    sharp(inputBuffer)
      .resize(1600, 900, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize(600, 338, { fit: "cover", position: "centre" })
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
 * Uses the user's Gemini text model to synthesize a custom, high-detail 1600x900
 * scene illustration SVG (no text/logos/watermarks) when the native raster image
 * model returns 429 Free-Tier quota limit: 0, then rasterizes it via sharp to WebP.
 */
async function generateGeminiSceneSvgBuffer({ title, category, keyword }) {
  const res = await ai.models.generateContent({
    model: textModel(),
    contents: `Create a rich, atmospheric, photorealistic-style 1600x900 widescreen SVG artwork (viewBox="0 0 1600 900") symbolizing this news topic:
Title: "${title}"
Category: "${category}"
Keyword: "${keyword}"

Requirements:
- Return ONLY raw valid <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">...</svg> code (no markdown fences, no explanation).
- Use multi-stop <linearGradient> and <radialGradient> definitions, <filter> blur/glow effects, layered architectural/environmental silhouettes, depth-of-field light orbs, perspective grids, and realistic lighting contrast appropriate for "${category}".
- Strictly NO <text> elements, NO letters, NO words, NO logos, NO watermarks, and NO human faces.`,
  });

  const raw = res.text || "";
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) throw new Error("Gemini did not return valid SVG scene markup");
  // Strip any accidental <text> tags to guarantee zero text in image
  const cleanSvg = match[0].replace(/<text[\s\S]*?<\/text>/gi, "");
  return Buffer.from(cleanSvg, "utf8");
}

/**
 * Generates a 16:9 HD featured image using GEMINI_IMAGE_MODEL (with up to 2 retries
 * using a refined prompt), converts it with sharp into 1600px WebP + 600px thumbnail,
 * and uploads both to Supabase Storage "media". Never uses any third-party watermarked service.
 */
export async function generateFeaturedImage(promptOrMeta, slug) {
  const meta =
    typeof promptOrMeta === "string"
      ? { rawPrompt: promptOrMeta, title: slug, category: "Technology", keyword: "" }
      : promptOrMeta || {};

  const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image").trim();
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Try up to 2 attempts with GEMINI_IMAGE_MODEL (refining prompt on attempt 2)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildEditorialImagePrompt(meta, attempt);
    try {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: "16:9" },
        },
      });
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part) {
        const rawBuf = Buffer.from(part.inlineData.data, "base64");
        const { url } = await processAndUploadImage(rawBuf, slug);
        return url;
      }
    } catch (err) {
      console.warn(`[Image] Attempt ${attempt}/2 on ${model} failed:`, (err.message || "").slice(0, 120));
    }
  }

  // Fallback using the user's own Gemini API key (scene synthesis -> sharp 1600px WebP + 600px thumb)
  try {
    const svgBuf = await generateGeminiSceneSvgBuffer(meta);
    const { url } = await processAndUploadImage(svgBuf, slug);
    return url;
  } catch (err) {
    console.warn("[Image] Gemini scene synthesis fallback failed:", err.message);
    return null;
  }
}
