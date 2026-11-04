import { useEffect, useState } from "react";
import {
  Cpu, Zap, ShieldAlert, Save, Play, CheckCircle2, Clock, Image, Sliders
} from "lucide-react";
import { api } from "../../api.js";
import {
  Button, Badge, Card, Skeleton, Modal, useToast
} from "../../components/ui.jsx";

export default function Settings() {
  const { toast } = useToast();
  const [s, setS] = useState(null);
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api("/admin/settings")
      .then((data) => {
        setS(data);
        setInitial(data);
      })
      .catch((e) => setErr(`Error: ${e.message} — is the backend running on port 5000?`));
  }, []);

  if (!s) {
    return err ? (
      <Card className="border-rose-500/30 text-sm text-rose-600 dark:text-rose-400">{err}</Card>
    ) : (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const num = (k) => (e) => {
    const val = e.target.value;
    setS({ ...s, [k]: val === "" ? "" : Number(val) });
  };
  const txt = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const chk = (k) => (e) => setS({ ...s, [k]: e.target.checked });

  const validate = () => {
    const daily_target = Number(s.daily_target);
    const active_from = Number(s.active_from);
    const active_to = Number(s.active_to);
    if (!Number.isInteger(daily_target) || daily_target < 1 || daily_target > 50) {
      throw new Error("Articles / day must be a whole number between 1 and 50.");
    }
    if (s.active_from === "" || !Number.isInteger(active_from) || active_from < 0 || active_from > 23) {
      throw new Error("Active from (hour) must be between 0 and 23.");
    }
    if (s.active_to === "" || !Number.isInteger(active_to) || active_to < 1 || active_to > 24) {
      throw new Error("Active to (hour) must be between 1 and 24.");
    }
    if (active_from >= active_to) {
      throw new Error("Active from hour must be earlier than Active to hour.");
    }
    if (!String(s.model || "").trim()) {
      throw new Error("Gemini text model cannot be empty.");
    }
    if (!String(s.niche || "").trim()) {
      throw new Error("Editorial niche cannot be empty.");
    }
    return { ...s, daily_target, active_from, active_to };
  };

  const commitSave = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setErr("");
    try {
      const payload = validate();
      const updated = await api("/admin/settings", { method: "PUT", body: payload });
      setS(updated);
      setInitial(updated);
      setStatusMsg("Settings saved and applied to background workers.");
      toast("Settings saved successfully", "success");
    } catch (e) {
      setErr(e.message || "Failed to save settings");
      toast(e.message || "Validation error", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveClick = () => {
    try {
      const payload = validate();
      const enablingAuto = payload.mode === "auto" && initial?.mode !== "auto";
      const highQuota = payload.daily_target > 20 && (initial?.daily_target || 0) <= 20;
      if (enablingAuto || highQuota) {
        setConfirmOpen(true);
        return;
      }
      commitSave();
    } catch (e) {
      setErr(e.message);
      toast(e.message, "error");
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/admin/settings/test-connection", { method: "POST" });
      const text = `Connected ✓ Model "${r.model}" replied: ${r.reply}`;
      setStatusMsg(text);
      toast(text, "success");
    } catch (e) {
      setErr(e.message || "Connection test failed");
      toast(e.message || "Connection test failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const runAutomationNow = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/admin/automation/run-now", { method: "POST" });
      const text = r.message || "Automation tick completed.";
      setStatusMsg(text);
      toast(text, "info");
    } catch (e) {
      setErr(e.message || "Automation tick failed");
      toast(e.message || "Automation tick failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const publishAllWaitingNow = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/admin/articles/publish-approved", { method: "POST", body: { includePending: true } });
      const text = `Automatically approved & published ${r.published || 0} waiting post(s).`;
      setStatusMsg(text);
      toast(text, "success");
    } catch (e) {
      setErr(e.message || "Failed to publish waiting posts");
      toast(e.message || "Failed to publish waiting posts", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Engine & Automation Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure Gemini models, autonomous publishing mode, active hours, and daily volume
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.mode === "auto" ? "PUBLISHED" : "APPROVED"}>
            {s.mode === "auto" ? "Auto-Approve & Publish ON" : "Manual Approval Mode"}
          </Badge>
          <Badge tone={s.automation_enabled ? "PUBLISHED" : "DRAFT"}>
            {s.automation_enabled ? "Automation Active" : "Automation Paused"}
          </Badge>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500" />
          <span>{statusMsg}</span>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{err}</span>
        </div>
      )}

      {/* Section 1: Gemini Model Configuration */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Gemini AI Model</h2>
              <p className="text-xs text-slate-500">API credentials remain server-side in <code>server/.env</code></p>
            </div>
          </div>
          <Button variant="ghost" size="sm" loading={busy} onClick={testConnection}>
            Test connection
          </Button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Primary Text & Research Model
          </span>
          <input
            className="input font-mono text-sm"
            value={s.model}
            onChange={txt("model")}
            placeholder="gemini-3-flash-preview"
          />
        </label>
      </Card>

      {/* Section 2: Autonomous Publishing & Safety Controls */}
      <Card className="space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Autonomous Publishing Workflow</h2>
            <p className="text-xs text-slate-500">Control whether articles require human sign-off or publish automatically</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
          <div>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">
              Enable automatic research & article writing
            </span>
            <span className="text-xs text-slate-500">
              When enabled, the background scheduler discovers trends every 3h and writes toward your daily quota.
            </span>
          </div>
          <input
            type="checkbox"
            checked={s.automation_enabled}
            onChange={chk("automation_enabled")}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">
              Enable Automatic Post Approved & Auto-Publish Mode
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Automatically approves and publishes new and waiting posts immediately without manual review.
            </span>
          </div>
          <input
            type="checkbox"
            checked={s.mode === "auto"}
            onChange={(e) => setS({ ...s, mode: e.target.checked ? "auto" : "approval" })}
            className="h-5 w-5 rounded border-slate-300 text-emerald-600"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Publishing Mode
          </span>
          <select className="input" value={s.mode} onChange={txt("mode")}>
            <option value="auto">Auto Mode — Automatically approve & publish posts immediately (Enabled)</option>
            <option value="approval">Approval Mode — Save to Pending Approval for manual editorial review</option>
          </select>
        </label>

        {/* Visible Safety Warning when Auto mode is selected */}
        {s.mode === "auto" && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-bold">Safety Warning: Unsupervised Auto-Publishing Enabled</p>
              <p>
                In <strong>Auto Mode</strong>, newly generated articles that pass the automated quality gate (600+ words, 2+ sources, valid meta description, non-duplicate title) and any <code>APPROVED</code> articles will be published directly to the live website without manual review.
              </p>
            </div>
          </div>
        )}

        {/* Schedule & Quota Numbers */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Sliders className="h-3.5 w-3.5" /> Articles / Day (1–50)
            </span>
            <input
              type="number"
              min="1"
              max="50"
              className="input font-mono"
              value={s.daily_target}
              onChange={num("daily_target")}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Active From (0–23h)
            </span>
            <input
              type="number"
              min="0"
              max="23"
              className="input font-mono"
              value={s.active_from}
              onChange={num("active_from")}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Active To (1–24h)
            </span>
            <input
              type="number"
              min="1"
              max="24"
              className="input font-mono"
              value={s.active_to}
              onChange={num("active_to")}
            />
          </label>
        </div>

        {/* Niche & Images */}
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Publication Editorial Niche
          </span>
          <input className="input" value={s.niche} onChange={txt("niche")} />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-ink-950">
          <div className="flex items-center gap-3">
            <Image className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                Generate AI Featured Images
              </span>
              <span className="text-xs text-slate-500">
                Creates 16:9 editorial illustrations and uploads to Supabase Storage
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={s.generate_images}
            onChange={chk("generate_images")}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="primary" loading={busy} onClick={commitSave}>
              <Save className="h-4 w-4" /> Save settings
            </Button>
            <Button variant="ghost" loading={busy} onClick={publishAllWaitingNow}>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Approve & publish waiting posts
            </Button>
          </div>
          <Button variant="ghost" loading={busy} onClick={runAutomationNow}>
            <Play className="h-4 w-4 text-indigo-500" /> Run automation now
          </Button>
        </div>
      </Card>

      {/* Safety Confirmation Modal for Auto Mode or Daily Target > 20 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm High-Impact Automation Change"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={busy} onClick={commitSave}>
              Confirm & Save Settings
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {s.mode === "auto" && (
            <p>
              • You are enabling <strong>Auto Publishing Mode</strong>. Generated articles that pass quality checks will be published live immediately without human review.
            </p>
          )}
          {Number(s.daily_target) > 20 && (
            <p>
              • You have set a high daily target of <strong>{s.daily_target} articles/day</strong>, which will increase Gemini API token usage.
            </p>
          )}
          <p className="font-semibold text-slate-900 dark:text-white">
            Do you want to apply these settings?
          </p>
        </div>
      </Modal>
    </div>
  );
}
