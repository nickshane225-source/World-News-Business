# Bug Audit & Quality Log

This document tracks all identified bugs, edge cases, root causes, severity ratings, verification status, and testing methodology across the `ai-publisher-pro` codebase.

| ID | Location | Steps to Reproduce | Expected vs Actual | Root Cause | Severity | Status |
|---|---|---|---|---|---|---|
| **BUG-01** | `server/src/routes/auth.js:4-8` | Send `POST /api/auth/login` with `{ "email": null, "password": null }` or non-string body. | **Expected:** `401 Unauthorized` with JSON error.<br>**Actual:** Uncaught `TypeError: The first argument must be of type string... Received null`, crashing handler with 500. | `crypto.timingSafeEqual` and `Buffer.from` invoked without verifying arguments are non-empty strings. | **High** | **Fixed** |
| **BUG-02** | `server/src/routes/admin.js:108` | Send `POST /api/admin/articles/publish-approved` with `{ "includePending": false }`. | **Expected:** Only publish articles with status `APPROVED`.<br>**Actual:** Published both `APPROVED` and `PENDING_APPROVAL` articles. | Ternary expression used identical array `["APPROVED", "PENDING_APPROVAL"]` for both true and false conditions. | **Medium** | **Fixed** |
| **BUG-03** | `server/src/services/settings.service.js:159` | Send `PUT /api/admin/settings` with `{ "active_from": 23 }` when DB `active_to` is `20`. | **Expected:** Validation error `'Active from' hour must be earlier than 'Active to' hour`.<br>**Actual:** Validation passed, persisting invalid scheduling window. | Check was only executed if *both* `active_from` and `active_to` were provided in request body, ignoring existing database values. | **Medium** | **Fixed** |
| **BUG-04** | `client/src/api.js:16` & `client/src/components/ui.jsx:292` | Call `fmt("invalid-date")` or `timeAgo("invalid-date")`. | **Expected:** Graceful fallback string (`"—"` or `"Recently"`).<br>**Actual:** Threw `RangeError: Invalid time value`, crashing React UI with blank screen. | `new Date().toLocaleString()` called without verifying `!isNaN(dt.getTime())`. | **Medium** | **Fixed** |
| **BUG-05** | `client/src/pages/admin/ArticleEditor.jsx:254` | Click "Schedule publish" with invalid or partial datetime input. | **Expected:** User-facing validation warning.<br>**Actual:** Uncaught `RangeError: Invalid time value` thrown on `.toISOString()`. | Missing date validity validation before invoking `.toISOString()`. | **Medium** | **Fixed** |
| **BUG-06** | `server/src/routes/public.js:16-43` | Request `/api/public/articles?page=0&category=` or request sitemap when article date is malformed. | **Expected:** Sanitized pagination, category filtering, and valid XML.<br>**Actual:** Potential negative/zero offset or sitemap 500 crash on invalid date. | Missing `Math.max(1, page)` integer sanitation and missing date validation in XML generator. | **Low/Med** | **Fixed** |
| **BUG-07** | `server/src/routes/admin.js:175-182` | Send `POST /api/admin/articles/nonexistent-id/approve` or `POST /api/admin/articles/nonexistent-id/schedule` with empty body. | **Expected:** Clean `400` or `404` JSON response.<br>**Actual:** Unhandled exception or empty response payload. | Missing payload validation on `req.body.scheduled_at` and missing 404 check when article ID is not found. | **Low** | **Fixed** |
| **BUG-08** | `server/src/app.js:56-80` | Send malformed JSON payload in POST/PUT request. | **Expected:** Structured JSON `{ "error": "Invalid JSON payload" }` with 400 status.<br>**Actual:** Express default HTML error page. | Missing global Express JSON syntax error handling middleware. | **Low** | **Fixed** |

---

## How I Tested

1. **Automated Regression Test Suite (`server/tests/regression.test.mjs`)**:
   * Executed with Node.js built-in test runner (`node server/tests/regression.test.mjs`).
   * **Result**: **9 / 9 tests passed, 0 failures, 0 skipped** across all regression areas.
   * Specific tests include:
     - Safe rejection of non-string, null, empty bodies on `/api/auth/login` (BUG-01).
     - Guard against UI crashing on malformed dates in `fmt()` and `timeAgo()` (BUG-04).
     - Proper fallback and sanitation of NaN/negative pages and query params on `/api/public/articles` (BUG-06).
     - 404 responses on non-existent article routes (BUG-06).
     - Integrity check of `/sitemap.xml`, `/ads.txt` (with publisher ID `pub-1052993488526571`), and `/robots.txt`.
     - Graceful JSON 400 response on malformed JSON bodies without Express crashing (BUG-08).
     - Settings validation checking active hours window against database state on partial updates (BUG-03).
     - Admin route validation guards for scheduling with missing or invalid date/time (BUG-07).
     - Public tracking and category listing verification.

2. **Client Build Verification**:
   * Executed `npm --prefix client run build`.
   * **Result**: Vite 5 production build succeeded in 1.91s with 0 errors (`dist/assets/index-C98ur7iQ.js` 334.96 kB, `dist/assets/index-C7L3GTKh.css` 86.24 kB).
