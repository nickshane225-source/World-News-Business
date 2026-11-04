import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Compass, FileText, Settings as SettingsIcon,
  PanelLeftClose, PanelLeftOpen, ExternalLink, LogOut, Sun, Moon,
  Menu, X, Search, Sparkles, Play, Newspaper
} from "lucide-react";
import { api, getToken } from "../../api.js";
import { useTheme, useToast, Modal, Button } from "../../components/ui.jsx";

const NAV_ITEMS = [
  { to: "/admin", label: "Control Center", icon: LayoutDashboard, end: true },
  { to: "/admin/trending", label: "Trending Research", icon: Compass },
  { to: "/admin/articles", label: "Articles", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!getToken()) return <Navigate to="/admin/login" replace />;

  const activeNav = NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  ) || { label: "Article Editor" };

  const signOut = () => {
    localStorage.removeItem("token");
    toast("Signed out of Admin Console", "info");
    nav("/admin/login");
  };

  const commands = [
    { label: "Go to Control Center (Dashboard)", run: () => nav("/admin") },
    { label: "Go to Trending Research", run: () => nav("/admin/trending") },
    { label: "Go to Articles Manager", run: () => nav("/admin/articles") },
    { label: "Go to Automation Settings", run: () => nav("/admin/settings") },
    {
      label: "Action: Discover Trending Topics Now",
      run: async () => {
        await api("/admin/research/discover", { method: "POST" });
        toast("Topic discovery job started in background", "success");
        nav("/admin/trending");
      },
    },
    {
      label: "Action: Run Automation Tick Now",
      run: async () => {
        const r = await api("/admin/automation/run-now", { method: "POST" });
        toast(r.message || "Automation tick completed", "info");
      },
    },
    { label: `Theme: Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`, run: toggleTheme },
    { label: "Open Public News Website ↗", run: () => window.open("/", "_blank") },
  ].filter((c) => !cmdQuery.trim() || c.label.toLowerCase().includes(cmdQuery.toLowerCase()));

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-ink-950 dark:text-slate-100">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-800/80 bg-ink-900 text-slate-300 transition-all duration-200 md:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          {!collapsed && (
            <div className="flex items-center gap-2.5 truncate">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Newspaper className="h-4 w-4" />
              </div>
              <span className="truncate text-base font-extrabold text-white">
                AI<span className="text-indigo-400">Publisher</span> Pro
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="mx-auto rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 p-3" aria-label="Admin sidebar">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-elev-1"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800/80 p-3 space-y-1">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            title="View public site"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">View Public Site ↗</span>}
          </a>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <aside
            className="relative z-10 flex w-64 flex-col bg-ink-900 p-4 text-slate-300 shadow-elev-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-base font-extrabold text-white">
                AI<span className="text-indigo-400">Publisher</span> Pro
              </span>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1.5">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-slate-800 pt-3 space-y-1">
              <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300">
                <ExternalLink className="h-4 w-4" /> View Public Site ↗
              </a>
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-400">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area + Sticky Top Bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800 md:hidden"
                aria-label="Open navigation drawer"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="truncate">
                <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Editorial Command
                </p>
                <h2 className="truncate text-base font-extrabold text-slate-900 dark:text-white">
                  {activeNav.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-indigo-400 hover:text-slate-800 dark:border-slate-800 dark:bg-ink-900 dark:text-slate-400 sm:flex"
                title="Open Command Palette (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Quick actions…</span>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm dark:bg-ink-800">Ctrl K</kbd>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-elev-1 hover:bg-slate-50 dark:border-slate-800 dark:bg-ink-900 dark:text-slate-300"
                aria-label="Toggle theme"
                title="Toggle light/dark mode"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>

              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost !px-3 !py-1.5 !text-xs hidden sm:inline-flex"
              >
                Live Site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Modal (Ctrl+K) */}
      <Modal
        open={cmdOpen}
        onClose={() => { setCmdOpen(false); setCmdQuery(""); }}
        title="Command Palette"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-10"
              placeholder="Type a command or page name…"
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {commands.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCmdOpen(false);
                  setCmdQuery("");
                  c.run();
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-ink-800"
              >
                <span>{c.label}</span>
                <Play className="h-3.5 w-3.5 opacity-50" />
              </button>
            ))}
            {!commands.length && <p className="p-4 text-center text-xs text-slate-400">No matching commands.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
