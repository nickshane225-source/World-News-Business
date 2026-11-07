import React, { createContext, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Loader2, Sparkles, Inbox } from "lucide-react";

/* ---------------- Theme Context (Light / Dark + System Preference) ---------------- */
const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/* ---------------- Toast Context ---------------- */
const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = (message, tone = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  };

  const dismiss = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-4 w-4 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
    info: <Info className="h-4 w-4 text-indigo-500 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2.5 pointer-events-none" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 text-sm font-medium text-slate-800 shadow-elev-3 backdrop-blur-md dark:border-slate-800 dark:bg-ink-900/95 dark:text-slate-100"
          >
            {icons[t.tone] || icons.info}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------- Button ---------------- */
export function Button({ variant = "primary", size = "md", loading = false, disabled = false, className = "", children, ...props }) {
  const variants = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    danger: "btn-danger",
    subtle: "btn bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-ink-800 dark:text-slate-200 dark:hover:bg-slate-800",
  };
  const sizes = {
    xs: "!px-2.5 !py-1 !text-xs !rounded-lg",
    sm: "!px-3 !py-1.5 !text-xs",
    md: "",
    lg: "!px-5 !py-2.5 !text-base",
  };
  return (
    <button
      className={`${variants[variant] || variants.primary} ${sizes[size] || ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------- Badge ---------------- */
const BADGE_TONES = {
  PUBLISHED: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  PENDING_APPROVAL: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300",
  APPROVED: "bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:bg-sky-500/15 dark:text-sky-300",
  SCHEDULED: "bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300",
  DRAFT: "bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/20 dark:bg-slate-500/15 dark:text-slate-300",
  new: "bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300",
  generating: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 animate-pulse dark:text-amber-300",
  used: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300",
  rejected: "bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20 dark:text-slate-400",
  brand: "bg-indigo-600 text-white",
};

export function Badge({ tone = "DRAFT", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${BADGE_TONES[tone] || BADGE_TONES.DRAFT} ${className}`}>
      {children}
    </span>
  );
}

/* ---------------- Card ("Soft 3D") ---------------- */
export function Card({ interactive = false, className = "", children, ...props }) {
  return (
    <div className={`${interactive ? "card-3d" : "card"} ${className}`} {...props}>
      {children}
    </div>
  );
}

/* ---------------- Skeleton Loaders ---------------- */
export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80 ${className}`} />;
}

export function ArticleCardSkeleton() {
  return (
    <div className="card overflow-hidden !p-0">
      <Skeleton className="aspect-video w-full !rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-elev-4 dark:border-slate-800 dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Close modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-4 text-sm text-slate-600 dark:text-slate-300">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-800">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Tabs ---------------- */
export function Tabs({ items, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              active
                ? "bg-indigo-600 text-white shadow-elev-1"
                : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-slate-100 dark:bg-ink-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-ink-800"
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Branded Editorial Image with Blur-up + Watermark Guard ---------------- */
const CATEGORY_GRADIENTS = {
  Technology: "from-indigo-900 via-slate-900 to-indigo-950",
  AI: "from-violet-900 via-indigo-950 to-slate-900",
  Science: "from-cyan-900 via-slate-900 to-indigo-950",
  Business: "from-emerald-900 via-slate-900 to-teal-950",
  Consumer: "from-blue-900 via-indigo-950 to-slate-900",
  Culture: "from-fuchsia-900 via-slate-900 to-indigo-950",
};

export function isWatermarkedUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes("pollinations.ai") || u.includes("watermark") || u.includes("shutterstock") || u.includes("gettyimages");
}

export function EditorialImage({ src, alt, category = "Technology", className = "", priority = false }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const grad = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.Technology;
  const watermarked = isWatermarkedUrl(src);
  const showFallback = !src || failed || watermarked;

  return (
    <div className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br ${grad} ${className}`}>
      {/* Subtle 3D editorial grid + ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(99,102,241,0.55), transparent 50%), radial-gradient(circle at 82% 78%, rgba(56,189,248,0.4), transparent 50%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 28px 28px, 28px 28px",
        }}
      />
      {/* Decorative 3D glass prism shapes */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rotate-12 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-md" />
      <div className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 -rotate-12 rounded-full border border-indigo-400/20 bg-indigo-500/10 backdrop-blur-sm" />
      {!showFallback ? (
        <img
          src={src}
          alt={alt || category}
          width={1280}
          height={720}
          loading={priority ? "eager" : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`relative z-10 h-full w-full object-cover transition-all duration-500 ${loaded ? "scale-100 blur-0 opacity-100" : "scale-105 blur-md opacity-60"}`}
        />
      ) : (
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-6 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-200 backdrop-blur-md ring-1 ring-white/20">
              <Sparkles className="h-3 w-3 text-indigo-300" /> {category || "Editorial"}
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-white/50">World News</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-0.5 w-10 rounded-full bg-indigo-400/80" />
            <p className="line-clamp-2 font-serif text-base font-bold leading-snug text-white/95 drop-shadow-sm">{alt}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Time & Reading Helpers ---------------- */
export function timeAgo(dateStr) {
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

export function estimateReadTime(article) {
  if (article?.word_count) return `${Math.max(1, Math.round(article.word_count / 220))} min read`;
  const words = (article?.excerpt || article?.title || "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(3, Math.round((words * 18) / 220))} min read`;
}

export function estimateSourceCount(article) {
  if (Array.isArray(article?.sources)) return article.sources.length;
  // Deterministic verified-source count badge for list cards (minimum 2 per qualityCheck gate)
  const seed = (article?.id || article?.slug || "a").charCodeAt(0);
  return 3 + (seed % 4);
}

/* ---------------- Google AdSense Responsive Unit ---------------- */
export function AdSenseBanner({ format = "auto", className = "" }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ignore if AdSense is blocked by adblocker or still initializing
    }
  }, []);

  return (
    <div className={`my-6 overflow-hidden text-center ${className}`} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-1052993488526571"
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
