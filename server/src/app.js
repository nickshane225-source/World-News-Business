import "./lib/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import publicRoutes, { sitemap, rssFeed } from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { requireAuth } from "./middleware/auth.js";
import { supabase } from "./lib/supabase.js";
import { injectArticleSeo, injectPageSeo } from "./services/seo.service.js";

const ALLOWED_ORIGINS = new Set([
  "https://worldnews.business",
  "https://www.worldnews.business",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  ...(process.env.SITE_URL ? [process.env.SITE_URL.replace(/\/$/, "")] : []),
  ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "")] : []),
]);

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

// Production: serve the built React app static assets before CORS
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        ALLOWED_ORIGINS.has(origin) ||
        (process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean).includes(origin)
      ) {
        return cb(null, true);
      }
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", requireAuth, adminRoutes);
app.get("/sitemap.xml", sitemap);
app.get("/rss.xml", rssFeed);
app.get("/ads.txt", (_, res) =>
  res
    .type("text/plain")
    .send(
      "google.com, pub-7539334939271132, DIRECT, f08c47fec0942fa0\ngoogle.com, pub-1052993488526571, DIRECT, f08c47fec0942fa0\n"
    )
);
app.get("/robots.txt", (_, res) =>
  res
    .type("text/plain")
    .send(`User-agent: *\nDisallow: /admin\nSitemap: ${process.env.SITE_URL || "https://worldnews.business"}/sitemap.xml\n`)
);

if (fs.existsSync(dist)) {
  const indexHtmlPath = path.join(dist, "index.html");
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/assets/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    try {
      const site = (process.env.SITE_URL || "https://worldnews.business").replace(/\/$/, "");
      const template = fs.readFileSync(indexHtmlPath, "utf8");

      const articleMatch = req.path.match(/^\/a\/([^/]+)\/?$/);
      if (articleMatch) {
        const slug = decodeURIComponent(articleMatch[1]);
        const { data: article } = await supabase
          .from("articles")
          .select("title,slug,meta_title,meta_description,excerpt,category,featured_image_url,published_at,updated_at,faqs")
          .eq("slug", slug)
          .eq("status", "PUBLISHED")
          .maybeSingle();

        if (article) {
          return res.type("text/html; charset=utf-8").send(injectArticleSeo(template, article, site));
        }
        return res.status(404).type("text/html; charset=utf-8").send(template);
      }

      if (req.path === "/about" || req.path === "/about/") {
        return res.type("text/html; charset=utf-8").send(
          injectPageSeo(template, {
            title: "About & Editorial Policy | World News",
            description: "Learn about World News editorial standards, multi-source verification process, and AI-assisted journalism disclosure.",
            url: `${site}/about`,
          })
        );
      }

      return res.type("text/html; charset=utf-8").send(template);
    } catch {
      return res.sendFile(indexHtmlPath);
    }
  });
}

// Global error handler for JSON parse errors & uncaught exceptions
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
