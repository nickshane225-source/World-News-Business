import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const ipCountryCache = new Map();
const recentHitDedup = new Map();

const TZ_TO_COUNTRY = {
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Detroit": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Montreal": "CA",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE",
  "Europe/Warsaw": "PL",
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Manila": "PH",
  "Asia/Jakarta": "ID",
  "Asia/Bangkok": "TH",
  "Asia/Kuala_Lumpur": "MY",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Africa/Lagos": "NG",
  "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG",
};

function getCountryName(code) {
  if (!code || code === "XX" || code === "T1" || code.length !== 2) return "United States";
  try {
    return regionNames.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function isPrivateOrLocalIp(ip = "") {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, "");
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)
  );
}

async function resolveCountry(req, tz = "", overrideCountry = "") {
  if (overrideCountry && /^[A-Za-z]{2}$/.test(overrideCountry.trim())) {
    const code = overrideCountry.trim().toUpperCase();
    return { code, name: getCountryName(code) };
  }

  // 1) Check CDN / Cloudflare / Render Geo-IP headers
  const headerCode = (
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["cloudfront-viewer-country"] ||
    req.headers["x-country-code"] ||
    ""
  )
    .toString()
    .trim()
    .toUpperCase();

  if (headerCode && headerCode.length === 2 && headerCode !== "XX" && headerCode !== "T1") {
    return { code: headerCode, name: getCountryName(headerCode) };
  }

  // 2) Public IP geolocation lookup with cache
  const rawIp =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    "";
  const ip = rawIp.replace(/^::ffff:/, "");

  if (ip && !isPrivateOrLocalIp(ip)) {
    if (ipCountryCache.has(ip)) return ipCountryCache.get(ip);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const j = await res.json();
        if (j?.status === "success" && j?.countryCode) {
          const code = j.countryCode.toUpperCase();
          const result = { code, name: j.country || getCountryName(code) };
          ipCountryCache.set(ip, result);
          return result;
        }
      }
    } catch {
      // Fall through to timezone mapping
    }
  }

  // 3) Browser Timezone fallback (ideal for local dev & fallback)
  if (tz && TZ_TO_COUNTRY[tz]) {
    const code = TZ_TO_COUNTRY[tz];
    return { code, name: getCountryName(code) };
  }

  return { code: "US", name: "United States" };
}

export async function recordVisit(req, body = {}) {
  const rawPath = String(body?.path || "/").trim() || "/";
  if (rawPath.startsWith("/admin")) return { skipped: true };

  const rawIp =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    "local";
  const ua = (req.headers["user-agent"] || "browser").toString();
  const rawVid = body?.visitorId || body?.vid;
  const visitorId =
    rawVid && typeof rawVid === "string"
      ? rawVid.slice(0, 24)
      : "v_" + crypto.createHash("sha256").update(`${rawIp}|${ua}`).digest("hex").slice(0, 12);

  const dedupKey = `${visitorId}:${rawPath}`;
  const now = Date.now();
  const prev = recentHitDedup.get(dedupKey);
  if (prev && now - prev < 10000) {
    return { ok: true, deduplicated: true };
  }
  recentHitDedup.set(dedupKey, now);
  if (recentHitDedup.size > 2000) {
    const firstKey = recentHitDedup.keys().next().value;
    recentHitDedup.delete(firstKey);
  }

  const { code, name } = await resolveCountry(req, body?.tz, body?.country);

  await supabase.from("generation_logs").insert({
    kind: "pageview",
    topic: rawPath.slice(0, 200),
    model: `${code}|${name}`,
    ok: true,
    error: visitorId,
    duration_ms: 0,
  });

  return { ok: true, countryCode: code, countryName: name, visitorId };
}

export async function getVisitorStats() {
  const { data: rows } = await supabase
    .from("generation_logs")
    .select("topic,model,error,created_at")
    .eq("kind", "pageview")
    .order("created_at", { ascending: false })
    .limit(5000);

  const visits = rows || [];
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const allVisitors = new Set();
  const visitors24h = new Set();
  const activeNowSet = new Set();
  let views24h = 0;

  const countryMap = new Map();
  const pageMap = new Map();

  for (const v of visits) {
    const t = new Date(v.created_at).getTime();
    const vid = v.error || `anon_${t}`;
    const path = v.topic || "/";
    const [rawCode, rawName] = String(v.model || "US|United States").split("|");
    const code = (rawCode || "US").toUpperCase();
    const name = rawName || getCountryName(code);

    allVisitors.add(vid);
    if (t >= dayAgo) {
      views24h++;
      visitors24h.add(vid);
    }
    if (t >= fiveMinAgo) {
      activeNowSet.add(vid);
    }

    if (!countryMap.has(code)) {
      countryMap.set(code, { code, name, views: 0, visitorSet: new Set() });
    }
    const cEntry = countryMap.get(code);
    cEntry.views++;
    cEntry.visitorSet.add(vid);

    pageMap.set(path, (pageMap.get(path) || 0) + 1);
  }

  const totalViews = visits.length;
  const totalVisitors = allVisitors.size;

  const countries = Array.from(countryMap.values())
    .map((c) => ({
      code: c.code,
      name: c.name,
      views: c.views,
      visitors: c.visitorSet.size,
      pct: totalViews > 0 ? Math.round((c.views / totalViews) * 100) : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views);

  const topPages = Array.from(pageMap.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const recentVisits = visits.slice(0, 8).map((v) => {
    const [rawCode, rawName] = String(v.model || "US|United States").split("|");
    const code = (rawCode || "US").toUpperCase();
    return {
      path: v.topic || "/",
      code,
      name: rawName || getCountryName(code),
      created_at: v.created_at,
    };
  });

  return {
    activeNow: activeNowSet.size,
    visitors24h: visitors24h.size,
    views24h,
    totalVisitors,
    totalViews,
    countries,
    topPages,
    recentVisits,
  };
}
