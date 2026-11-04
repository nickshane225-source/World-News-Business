# World News — AI Publisher Pro

An autonomous, full-stack U.S. news, technology, science, and business publishing platform powered by the **Google Gemini API**, **Supabase (PostgreSQL + Storage)**, **Redis + BullMQ**, and **React + Vite + Tailwind CSS**.

It discovers breaking U.S. trends from multi-source feeds (Google News RSS + Reddit), conducts grounded multi-source fact research, writes long-form (900–1,300 word) structured dispatches with **Key Takeaways** and **FAQs**, generates 16:9 high-definition WebP editorial imagery (`1600×900` + `600×338` thumbnails), runs automated editorial quality gates, and supports both **Automatic Post Approval & Auto-Publish Mode** and **Manual Editorial Review / Scheduled Publishing**.

---

## Table of Contents
1. [Project Requirements](#1-project-requirements)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Key Features](#3-key-features)
4. [Environment Variables (`server/.env`)](#4-environment-variables-serverenv)
5. [Database & Storage Setup (Supabase)](#5-database--storage-setup-supabase)
6. [Local Installation & Running the App](#6-local-installation--running-the-app)
7. [Admin Dashboard & Automatic Post Approval Mode](#7-admin-dashboard--automatic-post-approval-mode)
8. [Production Deployment](#8-production-deployment)
9. [Project Structure](#9-project-structure)

---

## 1. Project Requirements

### System & Runtime Requirements
- **Node.js:** `v18.18+` or `v20 LTS+` (Node 20 LTS recommended for production)
- **npm:** `v9+` or `v10+`
- **Database & Storage:** A [Supabase](https://supabase.com/) project (PostgreSQL database + public Storage bucket named `media`)
- **AI API Key:** A [Google Gemini API Key](https://aistudio.google.com/) (`@google/genai` SDK)
  - *Text & Grounded Research:* `gemini-3.6-flash` (with automatic fallback to `gemini-3.5-flash` / `gemini-3-flash-preview` / `gemini-3.5-flash-lite`)
  - *16:9 HD Image Generation:* `gemini-3.1-flash-image` (requires Pay-as-you-go Tier 1 billing on Google AI Studio or Vertex AI API enabled; includes automatic `sharp` WebP fallback on Free Tier keys)
- **Queue / Cache (Optional Locally, Recommended in Production):**
  - **Redis:** `v6.2+` or `v7+` (via Docker `docker compose up -d redis` or local `redis-server`).
  - *Note:* If Redis is not running locally, the server automatically falls back to an in-process background runner so all topic discovery, article generation, and scheduled publishing continue to work seamlessly.

---

## 2. Tech Stack & Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend (`client/`)** | React 18, Vite 5, Tailwind CSS 3, React Router 6, Lucide Icons | Public digital publication (`World News`) + Admin CMS (`AI Publisher Pro`) with dark/light theme |
| **Backend (`server/`)** | Node.js, Express, `sanitize-html`, `sharp`, `jsonwebtoken` | REST API (`/api/public/*`, `/api/admin/*`, `/api/auth/*`), `sitemap.xml`, `robots.txt` |
| **AI Pipeline** | `@google/genai` (Gemini API) + Google News RSS | Trend scoring, grounded research, 900–1,300 word structured JSON writing, 16:9 WebP image generation |
| **Database & Media** | Supabase PostgreSQL + Supabase Storage (`media` bucket) | Stores articles, verified sources, trending topics, generation logs, settings, and WebP images |
| **Job Queue & Scheduler** | BullMQ + `ioredis` (with in-process fallback) | 3-hour trend discovery, 30-minute quota ticks, and 60-second scheduled/auto-approval publisher |

---

## 3. Key Features

### Public Website (`World News`)
- **Editorial Design System:** Responsive "soft 3D" card layout, dark/light mode toggle (persisted + system preference), live developing news ticker, category navigation, and instant search.
- **Featured Hero & Top Stories:** 16:9 aspect-ratio imagery with blur-up loading, branded fallback gradients, and numbered **Trending Now** sidebar.
- **Long-Form Article Reader (`/a/:slug` & `/article/:slug`):**
  - Sticky reading progress bar, estimated read time, and **AI-assisted, editorially reviewed** disclosure badge.
  - Auto-generated **In This Dispatch** table of contents for `H2`/`H3` sections.
  - Highlighted **Key Takeaways** summary box, expandable **FAQ Accordion**, and numbered **Verified Sources** list.
  - Visible `"AI-generated image"` caption on all generated featured images.
- **Editorial Policy Page (`/about`):** Dedicated disclosure of AI-assisted workflows, multi-source verification, and corrections policy.
- **Technical SEO:** Dynamic `/sitemap.xml`, `/robots.txt`, Open Graph tags, Twitter Summary Large Image cards, and canonical URLs.

### Admin Dashboard (`/admin`)
- **Overview (`/admin`):** Live KPI cards (Published, Approved, Pending Review, Scheduled, 24h Failures), Daily Target progress bar, and Generation Activity log.
- **Trending Research (`/admin/trending`):** One-click **Discover Trending Topics**, manual custom topic dispatch generator, real-time polling while jobs run, and **Retry** button for failed/stuck topics.
- **Articles Manager (`/admin/articles`):** Filter tabs (`All`, `Pending Approval`, `Approved`, `Scheduled`, `Published`, `Drafts`), search bar, quick **Approve** / **Publish** actions, and bulk **Publish All Approved** button.
- **Article Editor (`/admin/articles/:id`):** Full editor with Live HTML Preview, SEO fields (`slug`, `meta_title`, `meta_description`, `focus_keyword`), **Regenerate Image** button, date/time scheduler, and verified source inspector.
- **Engine & Automation Settings (`/admin/settings`):**
  - **Automatic Post Approved & Auto-Publish Mode (`mode = 'auto'`):** Automatically approves and publishes newly generated and waiting posts immediately.
  - **Manual Approval Mode (`mode = 'approval'`):** Holds generated dispatches in `PENDING_APPROVAL` for human sign-off.
  - Configurable daily target (`1–50` articles/day), active hours (`0–24h`), Gemini model name, editorial niche, and one-click **Test Connection** & **Run Automation Now**.

---

## 4. Environment Variables (`server/.env`)

Copy `server/.env.example` to `server/.env` and fill in your credentials. **Never commit `server/.env` to Git.**

```env
PORT=5000
SITE_URL=https://worldnews.business

# Supabase (Project Settings -> API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (BullMQ job queue)
REDIS_URL=redis://127.0.0.1:6379

# Admin Dashboard Credentials & JWT Secret
ADMIN_EMAIL=admin@worldnews.business
ADMIN_PASSWORD=change-this-strong-password
JWT_SECRET=change-this-32-char-random-secret

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

---

## 5. Database & Storage Setup (Supabase)

1. Create a new project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor** in your Supabase dashboard.
3. Paste the entire contents of [`database/schema.sql`](./database/schema.sql) and click **Run**.
   - Creates 5 tables with Row Level Security (RLS) enabled:
     - `automation_settings` (defaults to `automation_enabled = true`, `mode = 'auto'`, `daily_target = 10`)
     - `trending_topics`
     - `articles`
     - `article_sources`
     - `generation_logs`
   - Creates the public **`media`** storage bucket for storing `1600×900` WebP featured images and `600×338` `-thumb.webp` thumbnails.

---

## 6. Local Installation & Running the App

### Step 1: Start Redis (Optional — In-Process Fallback Included)
```bash
docker compose up -d redis
```

### Step 2: Install & Run the Backend (`server/`)
```bash
cd server
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, and ADMIN_PASSWORD
npm install
npm run dev
```
The API server and background worker will start on `http://127.0.0.1:5000`.

### Step 3: Install & Run the Frontend (`client/`)
Open a second terminal:
```bash
cd client
npm install
npm run dev
```
- **Public Website:** `http://localhost:5173`
- **Admin Dashboard:** `http://localhost:5173/admin/login`

---

## 7. Admin Dashboard & Automatic Post Approval Mode

1. Sign in at `http://localhost:5173/admin/login` using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server/.env`.
2. Go to **Settings (`/admin/settings`)**:
   - Click **Test connection** to verify your Gemini API key.
   - **Enable Automatic Post Approved & Auto-Publish Mode** is enabled by default (`mode = "auto"`). When active, all newly generated articles and any waiting `PENDING_APPROVAL` / `APPROVED` articles are automatically approved and published live (`PUBLISHED`).
   - If you prefer manual editorial review before posts go live, uncheck **Enable Automatic Post Approved & Auto-Publish Mode** (switches `mode` to `"approval"`).
3. Go to **Trending (`/admin/trending`)**:
   - Click **Discover trending topics** to fetch and score live U.S. news & tech stories, or enter a custom headline in the manual generator.
   - Click **Write** on any topic (or click **Run automation now** in Settings) to generate a complete 900–1,300 word article with verified citations and a 16:9 WebP image.

---

## 8. Production Deployment

For a complete step-by-step Linux VPS production deployment guide (DNS `A` records, Node 20, Redis, PM2, Nginx reverse proxy, Let's Encrypt SSL via Certbot, UFW firewall, and automated daily backups), see [**`DEPLOYMENT.md`**](./DEPLOYMENT.md).

Quick production build test:
```bash
cd client && npm run build
cd ../server && NODE_ENV=production npm start
```

---

## 9. Project Structure

```text
ai-publisher-pro/
├── client/                     # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/ui.jsx   # Design system (Button, Badge, Card, Modal, EditorialImage, Toast)
│   │   ├── pages/
│   │   │   ├── public/         # Home.jsx, ArticlePage.jsx, AboutPage.jsx
│   │   │   └── admin/          # AdminLayout, Login, Dashboard, Trending, Articles, ArticleEditor, Settings
│   │   ├── api.js              # Authenticated fetch wrapper
│   │   ├── App.jsx             # Client routes
│   │   └── index.css           # Tailwind & CSS elevation/theme tokens
│   └── vite.config.js          # Dev proxy to http://127.0.0.1:5000
├── database/
│   └── schema.sql              # Supabase PostgreSQL schema + RLS + 'media' storage bucket
├── server/                     # Node.js + Express + BullMQ + Gemini backend
│   ├── src/
│   │   ├── lib/                # env.js, gemini.js, redis.js, supabase.js, text.js
│   │   ├── middleware/auth.js  # JWT authentication middleware
│   │   ├── queues/index.js     # BullMQ queue + automatic in-process fallback
│   │   ├── routes/             # public.js, admin.js, auth.js
│   │   ├── services/           # research.service.js, writer.service.js, image.service.js, pipeline.service.js, settings.service.js
│   │   ├── workers/index.js    # Background worker + scheduler tick
│   │   ├── app.js              # Express app, CORS, robots.txt, static SPA serving
│   │   └── server.js           # Entrypoint + cron schedules
│   └── .env.example            # Safe environment template (no secrets)
├── DEPLOYMENT.md               # Step-by-step Ubuntu VPS + Nginx + SSL deployment guide
├── docker-compose.yml          # Local Redis container
└── README.md                   # Project documentation & requirements
```
