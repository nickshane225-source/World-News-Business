import "./lib/env.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import publicRoutes, { sitemap } from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { requireAuth } from "./middleware/auth.js";

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
        origin.endsWith(".onrender.com") ||
        origin.endsWith(".worldnews.business")
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
app.get("/ads.txt", (_, res) =>
  res.type("text/plain").send("google.com, pub-1052993488526571, DIRECT, f08c47fec0942fa0\n")
);
app.get("/robots.txt", (_, res) =>
  res
    .type("text/plain")
    .send(`User-agent: *\nDisallow: /admin\nSitemap: ${process.env.SITE_URL || "https://worldnews.business"}/sitemap.xml\n`)
);

if (fs.existsSync(dist)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/assets/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}

export default app;
