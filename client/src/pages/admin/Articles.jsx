import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, RefreshCw, AlertTriangle, ArrowUpDown, CheckCircle2,
  Send, Trash2, Edit3, ArchiveRestore, CheckSquare, ExternalLink
} from "lucide-react";
import { api, fmt } from "../../api.js";
import {
  Button, Badge, Card, Tabs, Skeleton, EmptyState, Modal, useToast
} from "../../components/ui.jsx";

const TABS = ["", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED", "DRAFT"];

export default function Articles() {
  const { toast } = useToast();
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState({ key: "date", dir: "desc" });
  const [selected, setSelected] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async (silent = false) => {
    if (!silent && !allRows.length) setLoading(true);
    try {
      const data = await api("/admin/articles");
      setAllRows(data);
    } catch (e) {
      toast(e.message || "Failed to load articles", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { "": allRows.length, PENDING_APPROVAL: 0, APPROVED: 0, SCHEDULED: 0, PUBLISHED: 0, DRAFT: 0 };
    for (const a of allRows) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [allRows]);

  const filtered = useMemo(() => {
    const rows = allRows.filter((a) => {
      if (tab && a.status !== tab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.slug || "").toLowerCase().includes(q)
      );
    });

    return [...rows].sort((x, y) => {
      const dir = sortBy.dir === "asc" ? 1 : -1;
      if (sortBy.key === "title") return (x.title || "").localeCompare(y.title || "") * dir;
      if (sortBy.key === "words") return ((x.word_count || 0) - (y.word_count || 0)) * dir;
      const dx = new Date(x.published_at || x.scheduled_at || x.created_at || 0).getTime();
      const dy = new Date(y.published_at || y.scheduled_at || y.created_at || 0).getTime();
      return (dx - dy) * dir;
    });
  }, [allRows, tab, search, sortBy]);

  const toggleSort = (key) => {
    setSortBy((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  };

  const quick = async (id, action, label) => {
    setBusyId(id);
    try {
      await api(`/admin/articles/${id}/${action}`, { method: "POST" });
      toast(label || `Article ${action}ed`, "success");
      await load(true);
    } catch (e) {
      toast(e.message || "Action failed", "error");
    } finally {
      setBusyId("");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api(`/admin/articles/${deleteTarget.id}`, { method: "DELETE" });
      toast("Article permanently deleted", "success");
      setDeleteTarget(null);
      setSelected((prev) => prev.filter((x) => x !== deleteTarget.id));
      await load(true);
    } catch (e) {
      toast(e.message || "Delete failed", "error");
    } finally {
      setBusyId("");
    }
  };

  const publishAllApproved = async () => {
    setBusyId("bulk");
    try {
      const r = await api("/admin/articles/publish-approved", { method: "POST" });
      toast(`Published ${r.published} approved article(s)`, "success");
      await load(true);
    } catch (e) {
      toast(e.message || "Bulk publish failed", "error");
    } finally {
      setBusyId("");
    }
  };

  const runBulk = async (action) => {
    if (!selected.length) return;
    setBusyId("bulk");
    try {
      for (const id of selected) {
        if (action === "delete") await api(`/admin/articles/${id}`, { method: "DELETE" });
        else await api(`/admin/articles/${id}/${action}`, { method: "POST" });
      }
      toast(`Completed '${action}' on ${selected.length} article(s)`, "success");
      setSelected([]);
      await load(true);
    } catch (e) {
      toast(e.message || "Bulk action failed", "error");
    } finally {
      setBusyId("");
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelected(selected.length === filtered.length ? [] : filtered.map((a) => a.id));

  const tabItems = TABS.map((t) => ({
    value: t,
    label: t ? t.replace("_", " ") : "All",
    count: counts[t] || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Editorial Articles Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review quality checks, edit copy & metadata, approve, schedule, or publish dispatches
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {counts.APPROVED > 0 && (
            <Button variant="primary" size="sm" loading={busyId === "bulk"} onClick={publishAllApproved}>
              <Send className="h-3.5 w-3.5" /> Publish all approved ({counts.APPROVED})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => load(false)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Chips with Counts + Search Input */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabItems} value={tab} onChange={(v) => { setTab(v); setSelected([]); }} />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-1.5 !pl-9 text-xs"
            placeholder="Search title, category, slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-950 px-4 py-2.5 text-xs text-white shadow-elev-2">
          <span className="font-semibold">
            <CheckSquare className="mr-1.5 inline h-4 w-4 text-indigo-400" />
            {selected.length} article(s) selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="xs" disabled={!!busyId} onClick={() => runBulk("publish")}>
              <Send className="h-3 w-3" /> Publish Selected
            </Button>
            <Button variant="ghost" size="xs" disabled={!!busyId} onClick={() => runBulk("approve")}>
              <CheckCircle2 className="h-3 w-3" /> Approve Selected
            </Button>
            <Button variant="danger" size="xs" disabled={!!busyId} onClick={() => runBulk("delete")}>
              <Trash2 className="h-3 w-3" /> Delete Selected
            </Button>
            <button type="button" onClick={() => setSelected([])} className="ml-2 text-slate-400 hover:text-white">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Sortable Articles Table */}
      <Card className="overflow-x-auto !p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No articles in this view"
              description={search ? `No articles matched "${search}".` : "Generate an article from Trending Research to get started."}
              action={
                <Link to="/admin/trending">
                  <Button variant="primary" size="sm">Go to Trending Research</Button>
                </Link>
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
                    aria-label="Select all articles"
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="py-3.5 pr-4">
                  <button type="button" onClick={() => toggleSort("title")} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-white">
                    Headline <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 pr-3">Category</th>
                <th className="py-3.5 pr-3">Status</th>
                <th className="py-3.5 pr-3">
                  <button type="button" onClick={() => toggleSort("words")} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-white">
                    Words <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 pr-3">
                  <button type="button" onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-white">
                    Timestamp <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((a) => (
                <tr key={a.id} className="align-top transition hover:bg-slate-50/70 dark:hover:bg-ink-800/40">
                  <td className="py-3.5 pl-5 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      aria-label={`Select ${a.title}`}
                      className="mt-1 rounded border-slate-300"
                    />
                  </td>
                  <td className="py-3.5 pr-4">
                    <Link
                      to={`/admin/articles/${a.id}`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {a.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono">/{a.slug}</span>
                      {a.status === "PUBLISHED" && (
                        <a
                          href={`/a/${a.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline"
                        >
                          Live <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {a.quality_notes && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span>{a.quality_notes}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {a.category}
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap">
                    <Badge tone={a.status}>{a.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300">
                    {a.word_count}
                  </td>
                  <td className="py-3.5 pr-3 whitespace-nowrap text-xs text-slate-400">
                    {fmt(a.published_at || a.scheduled_at || a.created_at)}
                  </td>
                  <td className="py-3.5 pr-5 whitespace-nowrap text-right space-x-1.5">
                    {a.status !== "PUBLISHED" && (
                      <Button
                        variant="primary"
                        size="xs"
                        loading={busyId === a.id}
                        onClick={() => quick(a.id, "publish", "Article published live")}
                      >
                        Publish
                      </Button>
                    )}
                    {a.status === "PENDING_APPROVAL" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busyId === a.id}
                        onClick={() => quick(a.id, "approve", "Article approved")}
                      >
                        Approve
                      </Button>
                    )}
                    {a.status === "PUBLISHED" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={busyId === a.id}
                        onClick={() => quick(a.id, "unpublish", "Moved back to drafts")}
                      >
                        <ArchiveRestore className="h-3 w-3" /> Unpublish
                      </Button>
                    )}
                    <Link to={`/admin/articles/${a.id}`}>
                      <Button variant="ghost" size="xs" title="Edit article">
                        <Edit3 className="h-3 w-3" /> Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="!text-rose-500 hover:!bg-rose-500/10"
                      disabled={busyId === a.id}
                      onClick={() => setDeleteTarget(a)}
                      title="Delete article"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Article Permanently?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busyId === deleteTarget?.id} onClick={confirmDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete permanently
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
