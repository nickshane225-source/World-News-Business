import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, Newspaper, ShieldCheck, ArrowLeft } from "lucide-react";
import { api } from "../../api.js";
import { Button, useToast } from "../../components/ui.jsx";

export default function Login() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { token } = await api("/auth/login", { method: "POST", body: f });
      localStorage.setItem("token", token);
      toast("Welcome back to AI Publisher Pro", "success");
      nav("/admin");
    } catch (x) {
      setErr(x.message || "Invalid email or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-4 text-white">
      {/* Ambient 3D background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(79,70,229,0.45), transparent 45%), radial-gradient(circle at 80% 80%, rgba(56,189,248,0.25), transparent 45%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition">
          <ArrowLeft className="h-4 w-4" /> Back to Public Publication
        </Link>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-3xl border border-white/10 bg-ink-900/90 p-8 shadow-elev-4 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-elev-2">
              <Newspaper className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                AI Publisher <span className="text-indigo-400">Pro</span>
              </h1>
              <p className="text-xs font-medium text-slate-400">Editorial Control Center Sign In</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Admin Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="input !border-slate-800 !bg-ink-950 !pl-10 !text-white"
                  type="email"
                  placeholder="admin@aipublisher.local"
                  value={f.email}
                  onChange={(e) => { setF({ ...f, email: e.target.value }); setErr(""); }}
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="input !border-slate-800 !bg-ink-950 !pl-10 !text-white"
                  type="password"
                  placeholder="••••••••••••"
                  value={f.password}
                  onChange={(e) => { setF({ ...f, password: e.target.value }); setErr(""); }}
                  required
                />
              </div>
            </label>
          </div>

          {err && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-300">
              {err}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
            {busy ? "Authenticating…" : "Sign in to Control Center"}
          </Button>

          <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Protected by 12-hour JWT session security
          </p>
        </form>
      </div>
    </div>
  );
}
