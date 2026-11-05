import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw, CheckCircle2, Clock, CalendarClock, Sparkles,
  AlertTriangle, Activity, Cpu, ArrowUpRight, Globe, Users, Eye, Timer, Play
} from "lucide-react";
import { api, fmt } from "../../api.js";
import { Button, Badge, Card, Skeleton, useToast } from "../../components/ui.jsx";

function countryFlag(code = "US") {
  const c = String(code || "US").toUpperCase();
  if (c.length !== 2) return "🌐";
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

const INTERVAL_OPTIONS = [
  { value: 10, label: "Every 10m" },
  { value: 20, label: "Every 20m" },
  { value: 30, label: "Every 30m" },
  { value: 40, label: "Every 40m" },
  { value: 60, label: "Every 1 Hour" },
  { value: 0, label: "Daily Quota Mode" },
];

const DELAY_OPTIONS = [
  { value: 0, label: "Publish Immediately" },
  { value: 10, label: "10m Later" },
  { value: 20, label: "20m Later" },
  { value: 30, label: "30m Later" },
  { value: 40, label: "40m Later" },
  { value: 60, label: "1 Hour Later" },
];

function Sparkline({ points = [2, 4, 3, 6, 5, 8, 7], color = "#6366f1" }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(1, max - min);
  const coords = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * 84;
      const y = 26 - ((p - min) / range) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width="88" height="28" viewBox="0 0 88 28" className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, spark, to }) {
  const inner = (
    <Card interactive className="flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-ink-800" style={{ color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800/80">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</span>
        <Sparkline points={spark} color={color} />
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [savingTimer, setSavingTimer] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const x = await api("/admin/dashboard");
      setD(x);
      setErr("");
      if (manual) toast("Dashboard metrics refreshed", "success");
    } catch (e) {
      setErr(e.message || "Request failed");
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(false), 15000);
    const clock = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(clock);
    };
  }, []);

  const updateTimerSetting = async (patch, label) => {
    setSavingTimer(true);
    try {
      await api("/admin/settings", { method: "PUT", body: patch });
      toast(label, "success");
      await load(false);
    } catch (e) {
      toast(e.message || "Failed to update timer setting", "error");
    } finally {
      setSavingTimer(false);
    }
  };

  const triggerAutoPostNow = async () => {
    setSavingTimer(true);
    try {
      const r = await api("/admin/automation/run-now", { method: "POST" });
      toast(r.message || "Triggered automatic AI post", "info");
      await load(false);
    } catch (e) {
      toast(e.message || "Failed to trigger automation", "error");
    } finally {
      setSavingTimer(false);
    }
  };

  const sevenDayData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const label = dt.toLocaleDateString("en-US", { weekday: "short" });
      const count = (d?.logs || []).filter(
        (l) => l.ok && (l.kind === "article" || !l.kind) && (l.created_at || "").slice(0, 10) === key
      ).length;
      days.push({ key, label, count: i === 0 ? Math.max(count, d?.today || 0) : count });
    }
    return days;
  }, [d]);

  if (!d && err) {
    return (
      <Card className="space-y-4 border-rose-500/30">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <p className="font-bold">Could not load the Control Center: {err}</p>
        </div>
        <p className="text-sm text-slate-500">
          Ensure the backend server is running (<code>cd server && npm run dev</code>). Auto-retrying every 15 seconds.
        </p>
        <Button variant="primary" onClick={() => load(true)}>Retry now</Button>
      </Card>
    );
  }

  if (!d) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" /><Skeleton className="h-64 lg:col-span-2" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const target = Math.max(1, d.dailyTarget || 1);
  const pct = Math.min(100, Math.round(((d.today || 0) / target) * 100));
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;
  const maxBar = Math.max(...sevenDayData.map((x) => x.count), 1);

  const analytics = d.analytics || {
    activeNow: 0,
    visitors24h: 0,
    views24h: 0,
    totalVisitors: 0,
    totalViews: 0,
    countries: [],
    topPages: [],
    recentVisits: [],
  };

  const nextRunMs = d.nextAutoRunAt ? new Date(d.nextAutoRunAt).getTime() : 0;
  const diffSec = nextRunMs > nowMs ? Math.floor((nextRunMs - nowMs) / 1000) : 0;
  const countdownMins = Math.floor(diffSec / 60);
  const countdownSecs = diffSec % 60;

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Newsroom Telemetry & Live Audience
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time visitor countries, automatic AI post timer (10/20/30/40/60m), and pipeline health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/trending">
            <Button variant="ghost" size="sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Research Queue ({d.newTopics})
            </Button>
          </Link>
          <Button variant="ghost" size="sm" loading={refreshing} onClick={() => load(true)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Failure Alert Banner */}
      {d.failures24h > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>
              <strong>{d.failures24h} generation failure(s)</strong> recorded in the last 24 hours. Inspect the log table below for details.
            </span>
          </div>
          <a href="#generation-logs" className="font-bold underline">View logs ↓</a>
        </div>
      )}

      {/* KPI Cards with Sparklines */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Published Live"
          value={d.published}
          sub={`${d.total} total articles in DB`}
          icon={CheckCircle2}
          color="#10b981"
          spark={[1, 2, 2, 3, 3, 3, Math.max(3, d.published)]}
          to="/admin/articles"
        />
        <KpiCard
          label="Pending Approval"
          value={d.pending}
          sub={`${d.approved || 0} approved & ready`}
          icon={Clock}
          color="#f59e0b"
          spark={[0, 1, 2, 1, 2, 1, d.pending]}
          to="/admin/articles"
        />
        <KpiCard
          label="Scheduled Queue"
          value={d.scheduled}
          sub="Auto-publishes every 30s"
          icon={CalendarClock}
          color="#6366f1"
          spark={[0, 0, 1, 1, 0, 1, d.scheduled]}
          to="/admin/articles"
        />
        <KpiCard
          label="Unused Topics"
          value={d.newTopics}
          sub={`${d.generatingTopics || 0} currently writing`}
          icon={Sparkles}
          color="#0ea5e9"
          spark={[12, 18, 25, 22, 30, 32, d.newTopics]}
          to="/admin/trending"
        />
      </div>

      {/* Automatic AI Post Interval & Publish Delay Control Card */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-ink-900 dark:via-ink-900 dark:to-indigo-950/20">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-elev-1">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Automatic AI Post Timer & Schedule Delay
                </h2>
                <Badge tone={d.automationEnabled ? "PUBLISHED" : "DRAFT"}>
                  {d.automationEnabled ? "Auto-Timer Active" : "Paused"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how often AI generates a new article (10m / 20m / 30m / 40m / 1h) and whether it publishes immediately or 10m–1h later
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {d.automationEnabled && Number(d.intervalMinutes) > 0 && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                Next Auto-Post: {diffSec > 0 ? `${countdownMins}m ${String(countdownSecs).padStart(2, "0")}s` : "Running soon..."}
              </div>
            )}
            <Button variant="primary" size="sm" loading={savingTimer} onClick={triggerAutoPostNow}>
              <Play className="h-3.5 w-3.5" /> Generate AI Post Now
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {/* Option 1: How often AI automatically creates a post */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. AI Auto-Generation Frequency (Every 10 / 20 / 30 / 40 / 60m)
            </span>
            <div className="flex flex-wrap gap-2">
              {INTERVAL_OPTIONS.map((opt) => {
                const active = Number(d.intervalMinutes ?? 20) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={savingTimer}
                    onClick={() =>
                      updateTimerSetting(
                        { interval_minutes: opt.value, automation_enabled: true },
                        `Auto-post interval set to ${opt.label}`
                      )
                    }
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? "bg-indigo-600 text-white shadow-elev-1"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-ink-950 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-ink-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option 2: Publish immediately or 10/20/30/40/60m later */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Auto-Publish Timing (Immediate or 10 / 20 / 30 / 40m / 1h Later)
            </span>
            <div className="flex flex-wrap gap-2">
              {DELAY_OPTIONS.map((opt) => {
                const active = Number(d.publishDelayMinutes ?? 0) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={savingTimer}
                    onClick={() =>
                      updateTimerSetting(
                        { publish_delay_minutes: opt.value, mode: "auto" },
                        `Auto-publish timing set to ${opt.label}`
                      )
                    }
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? "bg-emerald-600 text-white shadow-elev-1"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-ink-950 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-ink-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Highest-Scoring Trend Priority Banner */}
        {d.topNewTopic && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 px-4 py-3 text-xs dark:border-indigo-500/30 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-black text-white shadow-elev-1">
                {d.topNewTopic.score}
              </span>
              <div>
                <span className="font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Top Priority Trend (Highest Score: {d.topNewTopic.score}/100):
                </span>{" "}
                <strong className="text-slate-900 dark:text-white">"{d.topNewTopic.title}"</strong>{" "}
                <span className="text-slate-500">({d.topNewTopic.category})</span>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ● Next in line for auto-post
            </span>
          </div>
        )}
      </Card>

      {/* Live Visitor & Country Analytics Section */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Website Visitors & Country Traffic
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time audience analytics across your public website
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            {analytics.activeNow} Online Now (Last 5m)
          </div>
        </div>

        {/* Visitor Mini KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Users className="h-3.5 w-3.5 text-emerald-500" /> Online Right Now
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-white">{analytics.activeNow}</p>
            <span className="text-[11px] text-slate-500">Active visitors in last 5 min</span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Users className="h-3.5 w-3.5 text-indigo-500" /> Visitors (24h)
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-white">{analytics.visitors24h}</p>
            <span className="text-[11px] text-slate-500">{analytics.totalVisitors} total unique visitors</span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Eye className="h-3.5 w-3.5 text-sky-500" /> Page Views (24h)
            </span>
            <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-white">{analytics.views24h}</p>
            <span className="text-[11px] text-slate-500">{analytics.totalViews} all-time page views</span>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Globe className="h-3.5 w-3.5 text-amber-500" /> Top Country
            </span>
            <p className="mt-1.5 text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {analytics.countries[0]
                ? `${countryFlag(analytics.countries[0].code)} ${analytics.countries[0].name}`
                : "No visits yet"}
            </p>
            <span className="text-[11px] text-slate-500">
              {analytics.countries.length} {analytics.countries.length === 1 ? "country" : "countries"} detected
            </span>
          </div>
        </div>

        {/* Countries Breakdown + Top Pages */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Visitors by Country Table */}
          <div className="lg:col-span-7 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Visitors by Country
            </h3>
            {analytics.countries.length > 0 ? (
              <div className="space-y-2.5">
                {analytics.countries.slice(0, 8).map((c) => (
                  <div
                    key={c.code}
                    className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-ink-950"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="text-base">{countryFlag(c.code)}</span>
                        <span>{c.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {c.code}
                        </span>
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        <strong>{c.visitors}</strong> {c.visitors === 1 ? "user" : "users"} · {c.views} views ({c.pct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(4, c.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                No visitor traffic recorded yet. Open the public homepage to record your first visit!
              </div>
            )}
          </div>

          {/* Top Visited Pages & Recent Visits */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Most Visited Pages & Live Stream
            </h3>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-ink-950 space-y-2.5">
              {analytics.topPages.length > 0 ? (
                analytics.topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono text-slate-700 dark:text-slate-300">{p.path}</span>
                    <Badge tone="SCHEDULED">{p.views} views</Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No page views yet</p>
              )}
            </div>

            {analytics.recentVisits.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-ink-950 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recent Visitor Hits</p>
                {analytics.recentVisits.slice(0, 4).map((rv, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate">
                      {countryFlag(rv.code)} <strong>{rv.name}</strong> → <code className="text-[11px]">{rv.path}</code>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{fmt(rv.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Daily Target Ring + 7-Day Output Chart + Pipeline Status */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Daily Target Progress Ring */}
        <Card className="flex flex-col justify-between lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Today's Quota
            </h2>
            <Badge tone={pct >= 100 ? "PUBLISHED" : "SCHEDULED"}>{pct}% Complete</Badge>
          </div>
          <div className="my-4 flex items-center gap-6">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112">
                <circle
                  cx="56"
                  cy="56"
                  r={ringRadius}
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={ringRadius}
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="text-indigo-600 transition-all duration-500 dark:text-indigo-400"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{d.today}</span>
                <span className="block text-[10px] font-bold uppercase text-slate-400">of {d.dailyTarget}</span>
              </div>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                {Math.max(0, d.dailyTarget - d.today)} dispatches remaining today
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {Number(d.intervalMinutes) > 0
                  ? `Auto-generates 1 post every ${d.intervalMinutes} min.`
                  : "Scheduled worker paces generation evenly across your active window."}
              </p>
              <Link to="/admin/settings" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Adjust target <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>

        {/* 7-Day Output Chart */}
        <Card className="flex flex-col justify-between lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              7-Day Generation Output
            </h2>
            <span className="text-xs text-slate-400">Articles / day</span>
          </div>
          <div className="mt-6 flex h-36 items-end justify-between gap-2 pt-4">
            {sevenDayData.map((day) => {
              const hPct = Math.max(10, Math.round((day.count / maxBar) * 100));
              return (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {day.count}
                  </span>
                  <div className="flex h-24 w-full items-end rounded-xl bg-slate-100 p-1 dark:bg-ink-950">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all duration-300"
                      style={{ height: `${hPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{day.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Pipeline Status Panel */}
        <Card className="flex flex-col justify-between lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Pipeline Status
            </h2>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="my-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-ink-950">
              <span className="font-medium text-slate-600 dark:text-slate-300">Writing / Active</span>
              <Badge tone={d.generatingTopics > 0 ? "generating" : "DRAFT"}>
                {d.generatingTopics || 0} active
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-ink-950">
              <span className="font-medium text-slate-600 dark:text-slate-300">Queued Topics</span>
              <Badge tone="new">{d.newTopics} ready</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-ink-950">
              <span className="font-medium text-slate-600 dark:text-slate-300">Awaiting Review</span>
              <Badge tone="PENDING_APPROVAL">{d.pending} pending</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-ink-950">
              <span className="font-medium text-slate-600 dark:text-slate-300">24h Failures</span>
              <Badge tone={d.failures24h > 0 ? "failed" : "PUBLISHED"}>{d.failures24h}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Live AI Generation History Table */}
      <Card id="generation-logs" className="overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">AI Generation Telemetry</h2>
            <p className="text-xs text-slate-500">Recent research and article synthesis jobs</p>
          </div>
          <Badge tone="DRAFT">{d.logs.length} recent events</Badge>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
            <tr>
              <th className="py-3 pr-3">Timestamp</th>
              <th className="py-3 pr-3">Stage</th>
              <th className="py-3 pr-3">Topic / Prompt</th>
              <th className="py-3 pr-3">Model</th>
              <th className="py-3 pr-3">Latency</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {d.logs.map((l) => (
              <tr key={l.id} className="align-top hover:bg-slate-50/60 dark:hover:bg-ink-800/40">
                <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-500">{fmt(l.created_at)}</td>
                <td className="py-3 pr-3">
                  <Badge tone={l.kind === "research" ? "SCHEDULED" : "DRAFT"}>
                    {l.kind || "article"}
                  </Badge>
                </td>
                <td className="py-3 pr-3">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{l.topic}</p>
                  {!l.ok && l.error && (
                    <p className="mt-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs text-rose-600 dark:text-rose-300">
                      {l.error}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-ink-800 dark:text-slate-300">
                    <Cpu className="h-3 w-3" /> {l.model}
                  </span>
                </td>
                <td className="py-3 pr-3 font-mono text-xs text-slate-500">
                  {Math.round((l.duration_ms || 0) / 1000)}s
                </td>
                <td className="py-3">
                  <Badge tone={l.ok ? "PUBLISHED" : "failed"}>
                    {l.ok ? "Success" : "Failed"}
                  </Badge>
                </td>
              </tr>
            ))}
            {!d.logs.length && (
              <tr>
                <td colSpan="6" className="py-10 text-center text-sm text-slate-400">
                  No AI generation events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
