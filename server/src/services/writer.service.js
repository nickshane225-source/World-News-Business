import { Type } from "@google/genai";
import { XMLParser } from "fast-xml-parser";
import { ai, textModel } from "../lib/gemini.js";

const xml = new XMLParser({ ignoreAttributes: false, processEntities: false });

async function fetchNewsRssSources(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(url, {
      headers: { "User-Agent": "WorldNewsBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { snippets: [], sources: [] };
    const text = await r.text();
    const items = xml.parse(text)?.rss?.channel?.item || [];
    const list = (Array.isArray(items) ? items : [items]).slice(0, 6);
    const sources = [];
    const snippets = [];
    for (const item of list) {
      if (item?.title && item?.link) {
        const cleanTitle = String(item.title).trim();
        const pubDate = item.pubDate ? ` (${item.pubDate})` : "";
        const sourceName = item.source?.["#text"] || item.source || "News Wire";
        sources.push({ title: `${cleanTitle} — ${sourceName}`, url: String(item.link).trim() });
        snippets.push(`- ${cleanTitle}${pubDate} [Source: ${sourceName}]`);
      }
    }
    return { snippets, sources };
  } catch {
    return { snippets: [], sources: [] };
  }
}

// Step 1: research with Google Search grounding + live News RSS verification -> factual notes + real source URLs
export async function researchNotes({ title, keyword, angle }, settings) {
  const rss = await fetchNewsRssSources(keyword || title);
  const rssContext = rss.snippets.length
    ? `\nVERIFIED LIVE NEWS WIRE HEADLINES:\n${rss.snippets.join("\n")}\n`
    : "";

  try {
    const res = await ai.models.generateContent({
      model: textModel(settings),
      contents: `Today is ${new Date().toDateString()}. Research this topic for a US news & technology publication using current web sources.
Topic: ${title}
Focus keyword: ${keyword || ""}
Angle: ${angle || ""}
${rssContext}
Return comprehensive, strictly factual research notes:
1. Confirmed facts, timeline, technical specifications, and institutional context.
2. Named organizations, agencies, or publications involved.
3. Explicitly separate CONFIRMED facts from UNCONFIRMED or developing claims.
4. Do NOT speculate or invent election outcomes, casualties, stock prices, or direct quotes.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seen = new Set();
    const groundedSources = chunks
      .map((c) => c.web)
      .filter((w) => w?.uri && !seen.has(w.uri) && seen.add(w.uri))
      .map((w) => ({ title: w.title || w.uri, url: w.uri }));

    const mergedSources = [...groundedSources];
    for (const s of rss.sources) {
      if (!seen.has(s.url) && mergedSources.length < 6) {
        seen.add(s.url);
        mergedSources.push(s);
      }
    }
    return { notes: res.text || rssContext, sources: mergedSources };
  } catch (err) {
    console.warn("Search grounding quota/fallback to RSS-grounded research:", (err.message || "").slice(0, 120));
    const res = await ai.models.generateContent({
      model: textModel(settings),
      contents: `Today is ${new Date().toDateString()}. Prepare detailed, conservative, fact-checked editorial research notes on this topic based on verified industry knowledge and the live news wire headlines below.
Topic: ${title}
Focus keyword: ${keyword || ""}
Angle: ${angle || ""}
${rssContext}
Rules:
- Only include verifiable background facts, established technical/policy mechanisms, and confirmed context from the headlines above.
- Never invent specific unverified numbers, election tallies, deaths, or fabricated quotes. Mark any developing detail as "unconfirmed".`,
    });
    return { notes: `${rssContext}\n${res.text || ""}`, sources: rss.sources };
  }
}

// Step 2: write publication-grade 900-1300 word article with Key Takeaways, subheadings, FAQs, and safe image prompt
export async function writeArticle({ title, keyword, angle, category }, notes, sources, settings) {
  const res = await ai.models.generateContent({
    model: textModel(settings),
    contents: `You are a senior correspondent and editor for "World News" (worldnews.business), a flagship US technology, business, and national news publication. Today is ${new Date().toDateString()}.
Write an original, deeply reported, publication-grade article for US readers that is **between 950 and 1,250 words** in clear, authoritative English.

Topic: ${title}
Focus keyword: ${keyword || title}
Editorial angle: ${angle || "In-depth analysis and implications for US readers"}
Category: ${category || "Technology"}

STRICT EDITORIAL & FACT-CHECKING RULES:
1. LENGTH & DEPTH: Write a comprehensive 950–1,250 word dispatch across 5 to 6 well-structured sections with descriptive <h2> and <h3> subheadings. Keep paragraphs concise (2 to 4 sentences per paragraph) for effortless reading.
2. OPENING & KEY TAKEAWAYS BOX:
   - Begin with a compelling 2-paragraph editorial hook that establishes why this story matters right now.
   - Immediately after the opening hook, include a section titled <h2>Key Takeaways</h2> followed by a <ul> containing 3 to 4 crisp, high-signal bullet points summarizing the core facts and implications.
3. FACTUAL INTEGRITY:
   - Rely ONLY on the verified research notes and cited sources below.
   - NEVER invent direct quotes, fabricated statistics, unverified election results, casualties, or speculative financial numbers.
   - Attribute claims naturally (e.g., "according to industry filings", "as reported by...", "analysts note"). If a detail is still developing, state that clearly.
4. HTML FORMAT:
   - contentHtml must use ONLY <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>. Do NOT include <h1> or repeat the main headline at the top.
5. METADATA & SEO:
   - metaTitle: 45–60 characters.
   - metaDescription: 120–155 characters (never exceed 160 characters).
   - excerpt: 130–190 characters summarizing the dispatch.
   - faqs: 4 substantive, reader-focused Q&As.
6. REALISTIC NEWS PHOTO PROMPT:
   - imagePrompt: Describe ONE realistic, camera-photographable news scene that a reader would instantly connect with this story — a real place, real objects, and anonymous ordinary people doing something relevant (e.g. "a pharmacist handing a prescription bag to a customer at a busy drugstore counter", "technicians walking between rows of server racks in a large data center"). Avoid abstract, futuristic, neon, or symbolic concepts. NEVER depict real identifiable people (politicians, executives, celebrities) and never include text, logos, or watermarks.
   - imageAlt: Clear, accessible description of that scene (under 120 characters).

GROUNDED RESEARCH NOTES:
${notes}

VERIFIED SOURCES (${sources.length}):
${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})`).join("\n") || "Standard editorial background"}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          metaTitle: { type: Type.STRING },
          metaDescription: { type: Type.STRING },
          focusKeyword: { type: Type.STRING },
          secondaryKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          excerpt: { type: Type.STRING },
          contentHtml: { type: Type.STRING },
          faqs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
              },
              required: ["question", "answer"],
            },
          },
          imagePrompt: { type: Type.STRING },
          imageAlt: { type: Type.STRING },
        },
        required: [
          "title",
          "metaTitle",
          "metaDescription",
          "focusKeyword",
          "excerpt",
          "contentHtml",
          "faqs",
          "imagePrompt",
          "imageAlt",
        ],
      },
    },
  });
  return JSON.parse(res.text);
}
