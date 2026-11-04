import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw, CheckCircle2, Clock, CalendarClock, Sparkles,
  AlertTriangle, Activity, Layers, Cpu, ArrowUpRight
} from "lucide-react";
import { api, fmt } from "../../api.js";
import { Button, Badge, Card, Skeleton, useToast } from "../../components/ui.jsx";

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
    return () => clearInterval(t);
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Newsroom Telemetry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live pipeline health, daily quota progress, and AI generation logs (auto-updates every 15s)
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
          sub="Auto-publishes every 1m"
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
                Scheduled worker paces generation evenly across your active window.
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
