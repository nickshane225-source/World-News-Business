import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, RefreshCw, Search, PenTool, SkipForward, RotateCcw,
  Loader2, CheckSquare, PlusCircle, Clock
} from "lucide-react";
import { api, fmt } from "../../api.js";
import {
  Button, Badge, Card, Tabs, Skeleton, EmptyState, useToast
} from "../../components/ui.jsx";

const STATUS_LIST = ["", "new", "generating", "used", "failed", "rejected"];
const CATEGORIES = ["Technology", "AI", "Science", "Business", "Consumer", "Culture"];

function ScoreBar({ score = 50 }) {
  const s = Math.min(100, Math.max(0, Number(score) || 0));
  const color = s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-indigo-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-950">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${s}%` }} />
      </div>
      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{s}</span>
    </div>
  );
}

export default function Trending() {
  const { toast } = useToast();
  const [allTopics, setAllTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pollingUntil, setPollingUntil] = useState(0);
  const [activeBanner, setActiveBanner] = useState("");
  const [manual, setManual] = useState({ title: "", keyword: "", category: "Technology" });

  const load = async (silent = false) => {
    if (!silent && !allTopics.length) setLoading(true);
    try {
      const rows = await api("/admin/research/topics");
      setAllTopics(rows);
      return rows;
    } catch (e) {
      if (!silent) toast(e.message || "Failed to load topics", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const generatingCount = allTopics.filter((t) => t.status === "generating").length;
  const isPolling = generatingCount > 0 || Date.now() < pollingUntil;

  useEffect(() => {
    if (!isPolling) {
      setActiveBanner("");
      return;
    }
    const timer = setInterval(() => {
      load(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPolling]);

  const counts = useMemo(() => {
    const c = { "": allTopics.length, new: 0, generating: 0, used: 0, failed: 0, rejected: 0 };
    for (const t of allTopics) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [allTopics]);

  const filtered = useMemo(() => {
    return allTopics.filter((t) => {
      if (tab && t.status !== tab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (t.title || "").toLowerCase().includes(q) ||
        (t.angle || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q) ||
        (t.keyword || "").toLowerCase().includes(q)
      );
    });
  }, [allTopics, tab, search]);

  const runAction = async (fn, successMsg, pollMs = 0) => {
    setBusy(true);
    try {
      await fn();
      toast(successMsg, "success");
      if (pollMs > 0) {
        setPollingUntil(Date.now() + pollMs);
        setActiveBanner(successMsg);
      }
      await load(true);
    } catch (e) {
      toast(e.message || "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map((t) => t.id));
  };

  const bulkAction = async (action) => {
    if (!selected.length) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await api(`/admin/research/topics/${id}/${action}`, { method: "POST" });
      }
      const label = action === "generate" ? `Queued ${selected.length} topic(s) for writing` : `Updated ${selected.length} topic(s)`;
      toast(label, "success");
      if (action === "generate") {
        setPollingUntil(Date.now() + 60000);
        setActiveBanner(label);
      }
      setSelected([]);
      await load(true);
    } catch (e) {
      toast(e.message || "Bulk action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const tabItems = STATUS_LIST.map((s) => ({
    value: s,
    label: s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Topics",
    count: counts[s] || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Trending Research & Pitch Desk
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Discover real-time U.S. news trends, score editorial angles, or pitch a custom topic
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-300">
            <Clock className="h-3.5 w-3.5 text-indigo-500" /> Auto-discovers every 1 hour
          </span>
          <Button variant="ghost" size="sm" onClick={() => load(false)} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={() =>
              runAction(
                () => api("/admin/research/discover", { method: "POST" }),
                "Scanning Google Trends & news feeds — new topics will appear automatically…",
                35000
              )
            }
          >
            <Sparkles className="h-4 w-4" /> Discover trending topics
          </Button>
        </div>
      </div>

      {/* Live Background Job Progress Banner */}
      {(generatingCount > 0 || activeBanner) && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
            <span>
              {generatingCount > 0
                ? `${generatingCount} topic(s) currently writing via Gemini — auto-refreshing every 3 seconds…`
                : activeBanner}
            </span>
          </div>
          <Badge tone="generating">Live Sync</Badge>
        </div>
      )}

      {/* Custom Topic Pitch Card */}
      <Card>
        <p className="mb-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <PlusCircle className="h-4 w-4 text-indigo-500" /> Commission Custom Dispatch
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            className="input flex-1 min-w-[220px]"
            placeholder="Headline or story pitch (e.g. 'OpenAI unveils next-gen reasoning agents')…"
            value={manual.title}
            onChange={(e) => setManual({ ...manual, title: e.target.value })}
          />
          <input
            className="input w-48"
            placeholder="Focus SEO keyword"
            value={manual.keyword}
            onChange={(e) => setManual({ ...manual, keyword: e.target.value })}
          />
          <select
            className="input w-40"
            value={manual.category}
            onChange={(e) => setManual({ ...manual, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button
            variant="primary"
            disabled={busy || !manual.title.trim()}
            onClick={() =>
              runAction(
                async () => {
                  await api("/admin/ai/generate-article", { method: "POST", body: manual });
                  setManual({ title: "", keyword: "", category: manual.category });
                },
                "Custom article queued for research & writing (~25s)",
                40000
              )
            }
          >
            <PenTool className="h-4 w-4" /> Write article
          </Button>
        </div>
      </Card>

      {/* Filter Tabs + Search + Bulk Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabItems} value={tab} onChange={(v) => { setTab(v); setSelected([]); }} />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-1.5 !pl-9 text-xs"
            placeholder="Filter topics, angles, keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-950 px-4 py-2.5 text-xs text-white shadow-elev-2">
          <span className="font-semibold">
            <CheckSquare className="mr-1.5 inline h-4 w-4 text-indigo-400" />
            {selected.length} topic(s) selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="xs" disabled={busy} onClick={() => bulkAction("generate")}>
              <PenTool className="h-3.5 w-3.5" /> Write Selected
            </Button>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => bulkAction("reject")}>
              <SkipForward className="h-3.5 w-3.5" /> Skip Selected
            </Button>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => bulkAction("reset")}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to New
            </Button>
            <button type="button" onClick={() => setSelected([])} className="ml-2 text-slate-400 hover:text-white">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Topics Table */}
      <Card className="overflow-x-auto !p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No topics match this filter"
              description="Click 'Discover trending topics' to scan live U.S. news feeds or switch status tabs."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => runAction(() => api("/admin/research/discover", { method: "POST" }), "Topic discovery started…", 35000)}
                >
                  Discover trending topics
                </Button>
              }
            />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-ink-950/50">
              <tr>
                <th className="py-3.5 pl-5 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.length === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all topics"
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="py-3.5 pr-4">Topic & Editorial Angle</th>
                <th className="py-3.5 pr-3">Category</th>
                <th className="py-3.5 pr-3">Trend Score</th>
                <th className="py-3.5 pr-3">Status</th>
                <th className="py-3.5 pr-3">Discovered</th>
                <th className="py-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((t) => (
                <tr key={t.id} className="align-top transition hover:bg-slate-50/70 dark:hover:bg-ink-800/40">
                  <td className="py-3.5 pl-5 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      aria-label={`Select ${t.title}`}
                      className="mt-1 rounded border-slate-300"
                    />
                  </td>
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.angle}</p>
                    {t.keyword && (
                      <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-ink-800 dark:text-slate-400">
                        kw: {t.keyword}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {t.category}
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap">
                    <ScoreBar score={t.score} />
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap">
                    <Badge tone={t.status}>{t.status}</Badge>
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap text-xs text-slate-400">
                    {fmt(t.created_at)}
                  </td>
                  <td className="py-3.5 pr-5 whitespace-nowrap text-right space-x-1.5">
                    {["new", "failed"].includes(t.status) && (
                      <>
                        <Button
                          variant="primary"
                          size="xs"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () => api(`/admin/research/topics/${t.id}/generate`, { method: "POST" }),
                              `Writing "${t.title}" — auto-refreshing until complete…`,
                              60000
                            )
                          }
                        >
                          <PenTool className="h-3 w-3" /> {t.status === "failed" ? "Retry" : "Write"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={busy}
                          onClick={() =>
                            runAction(() => api(`/admin/research/topics/${t.id}/reject`, { method: "POST" }), "Topic skipped")
                          }
                        >
                          Skip
                        </Button>
                      </>
                    )}
                    {["generating", "rejected"].includes(t.status) && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() =>
                          runAction(() => api(`/admin/research/topics/${t.id}/reset`, { method: "POST" }), "Topic reset to new")
                        }
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
