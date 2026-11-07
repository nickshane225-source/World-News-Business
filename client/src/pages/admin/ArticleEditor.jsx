import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Save, CheckCircle2, Send, CalendarClock, Trash2,
  AlertTriangle, ExternalLink, Eye, Code2, ShieldCheck, XCircle, Plus, X, Sparkles
} from "lucide-react";
import { api } from "../../api.js";
import {
  Button, Badge, Card, Skeleton, EmptyState, Modal, EditorialImage, useToast
} from "../../components/ui.jsx";

const Field = ({ label, hint, children }) => (
  <label className="block">
    <div className="mb-1 flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
    </div>
    {children}
  </label>
);

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function countWordsInHtml(html = "") {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

export default function ArticleEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [a, setA] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [when, setWhen] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api(`/admin/articles/${id}`)
      .then((data) => {
        setA(data);
        setWhen(toLocalInput(data.scheduled_at));
        setDirty(false);
        setErr("");
      })
      .catch((e) => setErr(e.message || "Could not load article"));
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const liveWords = useMemo(() => countWordsInHtml(a?.content_html || ""), [a?.content_html]);

  const seoChecks = useMemo(() => {
    if (!a) return [];
    const titleLen = (a.title || "").trim().length;
    const metaLen = (a.meta_description || "").trim().length;
    const srcCount = (a.sources || []).length;
    const hasAlt = Boolean((a.image_alt || "").trim());
    const hasKw = Boolean((a.focus_keyword || "").trim());
    return [
      {
        label: `Headline length (${titleLen} chars)`,
        ok: titleLen >= 35 && titleLen <= 95,
        detail: "Target 35–95 characters for optimal SERP display",
      },
      {
        label: `Meta description (${metaLen}/155 chars)`,
        ok: metaLen >= 80 && metaLen <= 170,
        detail: "Must be 80–170 characters to pass quality check",
      },
      {
        label: `Article depth (${liveWords} words)`,
        ok: liveWords >= 600,
        detail: "Minimum 600 words required by editorial gate",
      },
      {
        label: `Verified sources (${srcCount} linked)`,
        ok: srcCount >= 2,
        detail: "Minimum 2 external primary/secondary citations",
      },
      {
        label: "Featured image alt text",
        ok: hasAlt,
        detail: hasAlt ? "Alt text configured for WCAG AA & SEO" : "Missing accessible alt text",
      },
      {
        label: "Focus SEO keyword defined",
        ok: hasKw,
        detail: hasKw ? `Target: "${a.focus_keyword}"` : "Add a focus keyword",
      },
    ];
  }, [a, liveWords]);

  if (!a && err) {
    return (
      <EmptyState
        title="Article not found"
        description={err}
        action={<Link to="/admin/articles"><Button variant="primary">← Back to Articles</Button></Link>}
      />
    );
  }

  if (!a) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[600px] lg:col-span-7" />
          <Skeleton className="h-[600px] lg:col-span-5" />
        </div>
      </div>
    );
  }

  const set = (k) => (e) => {
    setA({ ...a, [k]: e.target.value });
    setDirty(true);
  };

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r) {
        setA((p) => ({ ...p, ...r }));
        if ("scheduled_at" in r) setWhen(toLocalInput(r.scheduled_at));
      }
      setDirty(false);
      toast(successMsg, "success");
    } catch (e) {
      toast(e.message || "Operation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const save = () => api(`/admin/articles/${id}`, { method: "PUT", body: a });
  const post = (action, body) => async () => {
    const saved = await save();
    const res = await api(`/admin/articles/${id}/${action}`, { method: "POST", body });
    return { ...saved, ...res };
  };

  const updateFaq = (idx, field, val) => {
    const next = [...(a.faqs || [])];
    next[idx] = { ...next[idx], [field]: val };
    setA({ ...a, faqs: next });
    setDirty(true);
  };

  const addFaq = () => {
    setA({ ...a, faqs: [...(a.faqs || []), { question: "", answer: "" }] });
    setDirty(true);
  };

  const removeFaq = (idx) => {
    setA({ ...a, faqs: (a.faqs || []).filter((_, i) => i !== idx) });
    setDirty(true);
  };

  const passedChecks = seoChecks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      {/* Sticky Top Action Bar */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800/80 dark:bg-ink-950/90 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/articles"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Articles
            </Link>
            <Badge tone={a.status}>{a.status.replace("_", " ")}</Badge>
            {dirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                ● Unsaved changes
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" loading={busy} onClick={() => run(save, "Changes saved")}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            {a.status !== "APPROVED" && a.status !== "PUBLISHED" && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(post("approve"), "Article approved")}>
                <CheckCircle2 className="h-3.5 w-3.5 text-sky-500" /> Approve
              </Button>
            )}
            <Button variant="primary" size="sm" loading={busy} onClick={() => run(post("publish"), "Article published live")}>
              <Send className="h-3.5 w-3.5" /> Publish now
            </Button>
            {a.status !== "DRAFT" && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(post("unpublish"), "Moved to drafts")}>
                Unpublish
              </Button>
            )}
            <Button variant="danger" size="sm" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Quality Warning Banner */}
      {a.quality_notes && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span><strong>Quality Gate Notes:</strong> {a.quality_notes}</span>
        </div>
      )}

      {/* Two-Column Split Layout: Editor Left (7 cols) | Live Preview + SEO Checklist Right (5 cols) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Form Inputs + HTML Editor */}
        <div className="space-y-6 lg:col-span-7">
          {/* Schedule Bar */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex-1 min-w-[220px]">
                <Field label="Schedule Automatic Publication" hint="Checked every 30s">
                  <input
                    type="datetime-local"
                    className="input"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </Field>
              </div>
              <Button
                variant="ghost"
                disabled={busy || !when}
                onClick={() => {
                  const target = new Date(when);
                  if (isNaN(target.getTime())) {
                    toast("Please enter a valid schedule date and time", "warning");
                    return;
                  }
                  run(
                    post("schedule", { scheduled_at: target.toISOString() }),
                    `Scheduled for ${target.toLocaleString()}`
                  );
                }}
              >
                <CalendarClock className="h-4 w-4 text-indigo-500" /> Schedule publish
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Auto-Publish Later:
              </span>
              {[
                { m: 10, label: "+10m Later" },
                { m: 20, label: "+20m Later" },
                { m: 30, label: "+30m Later" },
                { m: 40, label: "+40m Later" },
                { m: 60, label: "+1 Hour Later" },
              ].map((opt) => (
                <button
                  key={opt.m}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const target = new Date(Date.now() + opt.m * 60 * 1000);
                    setWhen(toLocalInput(target.toISOString()));
                    run(
                      post("schedule", { scheduled_at: target.toISOString() }),
                      `Scheduled to publish automatically in ${opt.m === 60 ? "1 hour" : `${opt.m} minutes`} (${target.toLocaleTimeString()})`
                    );
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:border-indigo-500 hover:bg-indigo-500 hover:text-white dark:border-slate-700 dark:bg-ink-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-600"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Metadata & SEO Fields */}
          <Card className="space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Headline & SEO Metadata
            </h2>
            <Field label="Headline" hint={`${(a.title || "").length} chars`}>
              <input className="input font-serif text-base font-bold" value={a.title || ""} onChange={set("title")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="URL Slug">
                <input className="input font-mono text-xs" value={a.slug || ""} onChange={set("slug")} />
              </Field>
              <Field label="Category">
                <input className="input" value={a.category || ""} onChange={set("category")} />
              </Field>
              <Field label="Meta Title">
                <input className="input" value={a.meta_title || ""} onChange={set("meta_title")} />
              </Field>
              <Field label="Focus Keyword">
                <input className="input" value={a.focus_keyword || ""} onChange={set("focus_keyword")} />
              </Field>
            </div>
            <Field label="Meta Description" hint={`${(a.meta_description || "").length}/155 chars`}>
              <textarea className="input" rows="2" value={a.meta_description || ""} onChange={set("meta_description")} />
            </Field>
            <Field label="Deck / Excerpt">
              <textarea className="input" rows="2" value={a.excerpt || ""} onChange={set("excerpt")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Featured Image URL">
                <input className="input text-xs" value={a.featured_image_url || ""} onChange={set("featured_image_url")} />
              </Field>
              <Field label="Image Alt Text (WCAG)">
                <input className="input text-xs" value={a.image_alt || ""} onChange={set("image_alt")} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-ink-950">
              <span className="text-slate-500">
                {a.featured_image_url ? "16:9 WebP + 600px thumbnail stored in Supabase Media" : "No featured image — click Regenerate image"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                loading={busy}
                onClick={() =>
                  run(
                    () => api(`/admin/articles/${id}/regenerate-image`, { method: "POST" }),
                    "Generated new 16:9 WebP featured image & 600px thumbnail"
                  )
                }
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Regenerate image
              </Button>
            </div>
          </Card>

          {/* Article Body HTML Editor */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                <Code2 className="h-4 w-4 text-indigo-500" /> Article HTML Body
              </span>
              <span className="font-mono text-xs font-semibold text-slate-500">
                {liveWords} words
              </span>
            </div>
            <textarea
              className="input font-mono text-xs leading-relaxed"
              rows="22"
              value={a.content_html || ""}
              onChange={set("content_html")}
            />
          </Card>

          {/* FAQ Editor */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                Structured FAQs ({(a.faqs || []).length})
              </h2>
              <Button variant="ghost" size="xs" type="button" onClick={addFaq}>
                <Plus className="h-3.5 w-3.5" /> Add FAQ
              </Button>
            </div>
            <div className="space-y-3">
              {(a.faqs || []).map((f, idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-slate-200/80 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      className="input !py-1.5 text-xs font-semibold"
                      placeholder="Question…"
                      value={f.question || ""}
                      onChange={(e) => updateFaq(idx, "question", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFaq(idx)}
                      className="rounded-lg p-1 text-slate-400 hover:text-rose-500"
                      title="Remove FAQ"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="input !py-1.5 text-xs"
                    rows="2"
                    placeholder="Answer…"
                    value={f.answer || ""}
                    onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                  />
                </div>
              ))}
              {!(a.faqs || []).length && (
                <p className="text-xs text-slate-400">No FAQ entries attached to this article.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column (Sticky): SEO & Editorial Readiness Checklist + Live Article Preview */}
        <div className="space-y-6 lg:col-span-5 lg:sticky lg:top-32">
          {/* SEO & Quality Gate Checklist */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> SEO & Editorial Gate
              </h2>
              <Badge tone={passedChecks === seoChecks.length ? "PUBLISHED" : "PENDING_APPROVAL"}>
                {passedChecks}/{seoChecks.length} Passed
              </Badge>
            </div>
            <ul className="space-y-2.5 text-xs">
              {seoChecks.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-ink-950">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{c.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Cited Sources */}
            {a.sources?.length > 0 && (
              <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cited Sources ({a.sources.length})
                </p>
                <ul className="space-y-1.5 text-xs">
                  {a.sources.map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span className="line-clamp-1">{s.title || s.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Live Article Preview Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                <Eye className="h-4 w-4 text-indigo-500" /> Live Editorial Preview
              </h2>
              <span className="text-[11px] text-slate-400">Reader view</span>
            </div>
            <div className="max-h-[540px] space-y-4 overflow-y-auto pr-1">
              <div className="overflow-hidden rounded-2xl">
                <EditorialImage
                  src={a.featured_image_url}
                  alt={a.image_alt || a.title}
                  category={a.category}
                />
              </div>
              <Badge tone="brand">{a.category || "Technology"}</Badge>
              <h3 className="font-serif text-xl font-bold leading-snug text-slate-900 dark:text-white">
                {a.title || "Untitled Article"}
              </h3>
              {a.excerpt && (
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {a.excerpt}
                </p>
              )}
              <div
                className="prose prose-slate prose-sm max-w-none border-t border-slate-100 pt-4 dark:prose-invert dark:border-slate-800 prose-headings:font-serif"
                dangerouslySetInnerHTML={{ __html: a.content_html || "" }}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Article Permanently?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/admin/articles/${id}`, { method: "DELETE" });
                  toast("Article deleted", "success");
                  nav("/admin/articles");
                } catch (e) {
                  toast(e.message || "Delete failed", "error");
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Confirm delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to permanently delete <strong>"{a.title}"</strong>?</p>
      </Modal>
    </div>
  );
}
