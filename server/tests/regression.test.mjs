import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../src/app.js";
import { updateSettings } from "../src/services/settings.service.js";

// Helper functions for testing client-side formatting logic in node
function fmt(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(dateStr) {
  if (!dateStr) return "Recently";
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return "Recently";
  const diff = Math.max(0, Date.now() - dt.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

let server;
let baseUrl;
let authToken = "";

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("BUG-01: POST /api/auth/login handles empty and non-string inputs safely without 500 crash", async () => {
  // Test empty body
  const resEmpty = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(resEmpty.status, 401);
  const dataEmpty = await resEmpty.json();
  assert.equal(dataEmpty.error, "Invalid credentials");

  // Test null inputs
  const resNull = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: null, password: null }),
  });
  assert.equal(resNull.status, 401);
  const dataNull = await resNull.json();
  assert.equal(dataNull.error, "Invalid credentials");

  // Test non-string types
  const resTypes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: 12345, password: ["admin"] }),
  });
  assert.equal(resTypes.status, 401);
  const dataTypes = await resTypes.json();
  assert.equal(dataTypes.error, "Invalid credentials");

  // Test valid login
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const resValid = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      }),
    });
    assert.equal(resValid.status, 200);
    const dataValid = await resValid.json();
    assert.ok(dataValid.token);
    authToken = dataValid.token;
  }
});

test("BUG-04: Date formatting helpers handle invalid / malformed date strings gracefully", () => {
  // fmt tests
  assert.equal(fmt(null), "—");
  assert.equal(fmt(undefined), "—");
  assert.equal(fmt(""), "—");
  assert.equal(fmt("invalid-date-string"), "—");
  assert.ok(fmt(new Date().toISOString()).length > 3);

  // timeAgo tests
  assert.equal(timeAgo(null), "Recently");
  assert.equal(timeAgo(undefined), "Recently");
  assert.equal(timeAgo("not-a-valid-date"), "Recently");
  assert.equal(timeAgo(new Date(Date.now() - 20000).toISOString()), "Just now");
  assert.equal(timeAgo(new Date(Date.now() - 150000).toISOString()), "2m ago");
});

test("BUG-06: GET /api/public/articles handles NaN/negative pagination and category safely", async () => {
  const res = await fetch(`${baseUrl}/api/public/articles?page=NaN&category=`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.page, 1);
  assert.ok(Array.isArray(data.articles));

  const resNeg = await fetch(`${baseUrl}/api/public/articles?page=-10`);
  assert.equal(resNeg.status, 200);
  const dataNeg = await resNeg.json();
  assert.equal(dataNeg.page, 1);
});

test("BUG-06: GET /api/public/articles/:slug returns 404 for unknown slug", async () => {
  const res = await fetch(`${baseUrl}/api/public/articles/non-existent-test-slug-9999`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error, "Not found");
});

test("Static & SEO files: sitemap.xml, ads.txt, robots.txt work correctly", async () => {
  // Ads.txt
  const adsRes = await fetch(`${baseUrl}/ads.txt`);
  assert.equal(adsRes.status, 200);
  const adsText = await adsRes.text();
  assert.ok(adsText.includes("pub-1052993488526571"));

  // Robots.txt
  const robotsRes = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robotsRes.status, 200);
  const robotsText = await robotsRes.text();
  assert.ok(robotsText.includes("User-agent: *"));
  assert.ok(robotsText.includes("Disallow: /admin"));

  // Sitemap.xml
  const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200);
  const sitemapXml = await sitemapRes.text();
  assert.ok(sitemapXml.includes("<urlset"));
});

test("BUG-08: Malformed JSON payloads return clean 400 JSON instead of HTML crash", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ malformed json payload",
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "Invalid JSON payload");
});

test("BUG-03: Partial updateSettings validates active hours window against existing DB values", async () => {
  await assert.rejects(
    async () => {
      // Trying to set active_from = 24 or invalid hour window
      await updateSettings({ active_from: 23, active_to: 10 });
    },
    {
      name: "Error",
      message: "'Active from' hour must be earlier than 'Active to' hour",
    }
  );
});

test("BUG-07: Admin route validation guards for schedule & non-existent article", async () => {
  if (!authToken) return;

  // Empty schedule body
  const resSchedEmpty = await fetch(`${baseUrl}/api/admin/articles/non-existent-id/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(resSchedEmpty.status, 400);
  const dataSchedEmpty = await resSchedEmpty.json();
  assert.equal(dataSchedEmpty.error, "scheduled_at is required");

  // Invalid schedule date
  const resSchedBad = await fetch(`${baseUrl}/api/admin/articles/non-existent-id/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ scheduled_at: "not-a-valid-date" }),
  });
  assert.equal(resSchedBad.status, 400);
  const dataSchedBad = await resSchedBad.json();
  assert.equal(dataSchedBad.error, "Invalid schedule date/time");

  // Non-existent article approve
  const resApprove = await fetch(`${baseUrl}/api/admin/articles/00000000-0000-0000-0000-000000000000/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });
  assert.equal(resApprove.status, 404);
});

test("Public API: /api/public/categories and /api/public/track execute successfully", async () => {
  const catRes = await fetch(`${baseUrl}/api/public/categories`);
  assert.equal(catRes.status, 200);
  const categories = await catRes.json();
  assert.ok(Array.isArray(categories));

  const trackRes = await fetch(`${baseUrl}/api/public/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "/test-view", tz: "America/New_York" }),
  });
  assert.equal(trackRes.status, 200);
  const trackData = await trackRes.json();
  assert.equal(trackData.ok, true);
  assert.equal(trackData.countryCode, "US");
});
