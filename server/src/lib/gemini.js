import "./env.js";
import { GoogleGenAI } from "@google/genai";
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite"];

// Wrap generateContent with exponential backoff and automatic model fallback for 503/429
const originalGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async function resilientGenerateContent(params, retries = 2) {
  const isImageRequest = params.config?.responseModalities?.includes("IMAGE");
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await originalGenerateContent(params);
    } catch (err) {
      const msg = err.message || "";
      const isTransient = err.status === 503 || err.status === 429 || msg.includes("503") || msg.includes("429") || msg.includes("high demand") || msg.includes("RESOURCE_EXHAUSTED");
      if (params.config?.tools && (err.status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED"))) {
        throw err;
      }
      if (isTransient && !isImageRequest) {
        for (const fb of FALLBACK_MODELS) {
          if (fb === params.model) continue;
          try {
            console.warn(`[Gemini] ${params.model} returned ${err.status || "429/503"}, trying fallback model ${fb}...`);
            return await originalGenerateContent({ ...params, model: fb });
          } catch {}
        }
      }
      if (isTransient && attempt < retries) {
        const delay = attempt * 1500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};

export const textModel = (settings) => settings?.model || process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";
