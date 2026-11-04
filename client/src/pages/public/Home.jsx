import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search, Sun, Moon, Menu, X, Flame, Clock, BookOpen, ShieldCheck,
  ArrowUpRight, Sparkles, Newspaper, ChevronRight
} from "lucide-react";
import { api } from "../../api.js";
import {
  useTheme, Button, Badge, EditorialImage, ArticleCardSkeleton,
  EmptyState, Modal, timeAgo, estimateReadTime, estimateSourceCount, AdSenseBanner
} from "../../components/ui.jsx";

export const SITE = "World News";
export const SITE_URL = "https://worldnews.business";

export function setSeoMeta({ title, description, url, image, type = "website" }) {
  if (title) document.title = title;
  const setMeta = (attr, key, val) => {
    if (!val) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", val);
  };
  setMeta("name", "description", description);
  setMeta("property", "og:site_name", SITE);
  setMeta("property", "og:type", type);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  if (image) setMeta("property", "og:image", image);
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  if (image) setMeta("name", "twitter:image", image);

  if (url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);
  }
}

const FOOTER_MODALS = {
  about: {
    title: "About World News",
    body: "World News (worldnews.business) is an independent U.S. technology, science, business, and national news publication. Our newsroom combines real-time trend discovery with multi-source verification and editorial quality gates to deliver clear, high-signal reporting.",
  },
  policy: {
    title: "Editorial & AI Disclosure Policy",
    body: "Every article published on World News is synthesized from multiple primary and secondary sources, checked against our automated and human editorial standards (minimum source verification, fact grounding, and originality checks), and clearly labeled with source citations.",
  },
  contact: {
    title: "Contact the Newsroom",
    body: "For press inquiries, corrections, or editorial tips, reach our U.S. desk at editorial@worldnews.business. Corrections are reviewed within 24 hours and noted transparently at the bottom of updated stories.",
  },
  privacy: {
    title: "Privacy & Reader Trust",
    body: "We respect reader privacy. World News does not sell personal data, avoids intrusive third-party ad trackers, and stores theme preferences locally in your browser.",
  },
};

export function Header({ categories = [], activeCategory = "", onSelectCategory, searchQuery = "", onSearchChange }) {
  const { theme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleCategoryClick = (c) => {
    setDrawerOpen(false);
    if (onSelectCategory) {
      onSelectCategory(c);
    } else {
      navigate(c ? `/?category=${encodeURIComponent(c)}` : "/");
    }
  };

  const navCats = categories.length ? categories : ["Technology", "AI", "Science", "Business"];

  return (
    <>
      <header className="glass-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          {/* Left: Mobile menu button + Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" onClick={() => onSelectCategory?.("")} className="group flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-elev-1 transition-transform group-hover:scale-105">
                <Newspaper className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  World<span className="text-indigo-600 dark:text-indigo-400">News</span>
                </span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:block">
                  US News · Tech · Business
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Desktop Category Navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary categories">
            <button
              type="button"
              onClick={() => handleCategoryClick("")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                activeCategory === "" && location.pathname === "/"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
              }`}
            >
              Top News
            </button>
            {navCats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleCategoryClick(c)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  activeCategory === c
                    ? "bg-indigo-600 text-white shadow-elev-1"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
                }`}
              >
                {c}
              </button>
            ))}
            <Link
              to="/about"
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                location.pathname === "/about"
                  ? "bg-indigo-600 text-white shadow-elev-1"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800"
              }`}
            >
              Editorial Policy
            </Link>
          </nav>

          {/* Right: Search + Dark mode toggle */}
          <div className="flex items-center gap-2">
            {onSearchChange && (
              <div className="relative hidden sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search stories…"
                  aria-label="Search stories"
                  className="w-44 rounded-full border border-slate-200 bg-slate-100/80 py-1.5 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all focus:w-60 focus:border-indigo-500 focus:bg-white dark:border-slate-800 dark:bg-ink-900 dark:text-slate-100"
                />
              </div>
            )}
            {onSearchChange && (
              <button
                type="button"
                onClick={() => setSearchOpen(!searchOpen)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800 sm:hidden"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl border border-slate-200/80 bg-white p-2 text-slate-700 shadow-elev-1 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-ink-900 dark:text-slate-200 dark:hover:bg-ink-800"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {searchOpen && onSearchChange && (
          <div className="border-t border-slate-200/80 px-4 py-2.5 dark:border-slate-800 sm:hidden">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search headlines, topics…"
              className="input !rounded-full !py-1.5 text-sm"
              autoFocus
            />
          </div>
        )}

        {/* Mobile Drawer Navigation */}
        {drawerOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-elev-3 dark:border-slate-800 dark:bg-ink-900 md:hidden">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Sections</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleCategoryClick("")}
                className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                  activeCategory === "" ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                Top News
              </button>
              {navCats.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCategoryClick(c)}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                    activeCategory === c ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

export function Footer() {
  const [modalKey, setModalKey] = useState(null);
  const activeModal = modalKey ? FOOTER_MODALS[modalKey] : null;

  return (
    <footer className="mt-20 border-t border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Newspaper className="h-4 w-4" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                World<span className="text-indigo-600 dark:text-indigo-400">News</span>
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              High-signal U.S. technology, science, and market reporting powered by multi-source AI synthesis and strict editorial verification at <strong>worldnews.business</strong>.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Editorial</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link to="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400">About & Editorial Policy</Link></li>
              <li><button type="button" onClick={() => setModalKey("policy")} className="hover:text-indigo-600 dark:hover:text-indigo-400">AI Disclosure & Ethics</button></li>
              <li><button type="button" onClick={() => setModalKey("contact")} className="hover:text-indigo-600 dark:hover:text-indigo-400">Contact & Corrections</button></li>
              <li><button type="button" onClick={() => setModalKey("privacy")} className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy Policy</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Syndication</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="/sitemap.xml" target="_blank" rel="noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">XML Sitemap ↗</a></li>
              <li><a href="/robots.txt" target="_blank" rel="noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">Indexing Policy ↗</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-slate-800">
          <span>© {new Date().getFullYear()} {SITE}. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Multi-source verified journalism
          </span>
        </div>
      </div>
      <Modal
        open={!!activeModal}
        onClose={() => setModalKey(null)}
        title={activeModal?.title}
        footer={<Button variant="primary" size="sm" onClick={() => setModalKey(null)}>Close</Button>}
      >
        <p className="leading-relaxed">{activeModal?.body}</p>
      </Modal>
    </footer>
  );
}

function ArticleMetaRow({ article, light = false }) {
  const muted = light ? "text-slate-300" : "text-slate-500 dark:text-slate-400";
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs font-medium ${muted}`}>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> {timeAgo(article.published_at)}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        <BookOpen className="h-3.5 w-3.5" /> {estimateReadTime(article)}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {estimateSourceCount(article)} sources
      </span>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState({ articles: [], page: 1, pages: 1 });
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSeoMeta({
      title: `${SITE} — US News, Technology & Business Intelligence`,
      description: "World News (worldnews.business) delivers verified U.S. national news, technology analysis, science, and market intelligence.",
      url: `${SITE_URL}/`,
    });
    api("/public/categories").then(setCats).catch(() => {});
  }, []);

  const load = (page = 1, append = false) => {
    setLoading(true);
    api(`/public/articles?page=${page}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`)
      .then((d) => setData((p) => ({ ...d, articles: append ? [...p.articles, ...d.articles] : d.articles })))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(1), [cat]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data.articles;
    const q = search.toLowerCase();
    return data.articles.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q)
    );
  }, [data.articles, search]);

  const [hero, ...rest] = filtered;
  const trending = filtered.slice(0, 5);

  const byCategory = useMemo(() => {
    const map = {};
    for (const a of data.articles) {
      const c = a.category || "Technology";
      if (!map[c]) map[c] = [];
      map[c].push(a);
    }
    return Object.entries(map);
  }, [data.articles]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        categories={cats}
        activeCategory={cat}
        onSelectCategory={setCat}
        searchQuery={search}
        onSearchChange={setSearch}
      />

      {/* Slim Developing / Breaking News Ticker */}
      {data.articles.length > 0 && (
        <div className="border-b border-slate-200/80 bg-slate-900 text-white dark:border-slate-800 dark:bg-ink-900">
          <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-2 text-xs sm:px-6">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 font-bold uppercase tracking-wider text-rose-300 ring-1 ring-rose-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" /> Developing
            </span>
            <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap py-0.5">
              {data.articles.slice(0, 4).map((a) => (
                <Link key={a.id} to={`/a/${a.slug}`} className="text-slate-200 hover:text-indigo-300 transition">
                  <strong className="mr-1.5 font-semibold text-indigo-400">{a.category}:</strong>
                  {a.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* Category Filter Pills */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {["", ...cats].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  cat === c
                    ? "bg-indigo-600 text-white shadow-elev-1"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-ink-900 dark:text-slate-300 dark:ring-slate-800"
                }`}
              >
                {c || "All Dispatches"}
              </button>
            ))}
          </div>
          {search && (
            <p className="text-xs text-slate-500">
              Showing {filtered.length} result(s) for <strong>"{search}"</strong>
            </p>
          )}
        </div>

        {/* Skeleton Loader State */}
        {loading && !data.articles.length && (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8"><ArticleCardSkeleton /></div>
              <div className="lg:col-span-4"><ArticleCardSkeleton /></div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <ArticleCardSkeleton /><ArticleCardSkeleton /><ArticleCardSkeleton />
            </div>
          </div>
        )}

        {/* Hero + Trending Now Sidebar */}
        {hero && (
          <section className="mb-12 grid gap-8 lg:grid-cols-12" aria-label="Featured story and trending">
            {/* Large Hero Story */}
            <Link
              to={`/a/${hero.slug}`}
              className="card-3d group relative flex flex-col overflow-hidden !bg-slate-950 !p-0 lg:col-span-8"
            >
              <div className="relative flex h-full min-h-[320px] flex-1 flex-col overflow-hidden sm:min-h-[420px]">
                <EditorialImage
                  src={hero.featured_image_url}
                  alt={hero.image_alt || hero.title}
                  category={hero.category}
                  priority
                  className="h-full w-full flex-1 transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 z-20 p-6 sm:p-8 text-white">
                  <Badge tone="brand" className="mb-3 uppercase tracking-widest">{hero.category}</Badge>
                  <h1 className="font-serif text-2xl font-bold leading-tight sm:text-4xl group-hover:text-indigo-200 transition">
                    {hero.title}
                  </h1>
                  <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-slate-200 sm:text-base">
                    {hero.excerpt}
                  </p>
                  <div className="mt-4">
                    <ArticleMetaRow article={hero} light />
                  </div>
                </div>
              </div>
            </Link>

            {/* Trending Now Numbered Sidebar */}
            <aside className="card flex flex-col justify-between lg:col-span-4" aria-label="Trending stories">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    <Flame className="h-4 w-4 text-rose-500" /> Trending Now
                  </h2>
                  <span className="text-[11px] font-semibold text-slate-400">Most Read</span>
                </div>
                <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {trending.map((t, idx) => (
                    <li key={t.id} className="py-3.5 first:pt-0 last:pb-0">
                      <Link to={`/a/${t.slug}`} className="group flex items-start gap-3.5">
                        <span className="font-mono text-2xl font-extrabold leading-none text-indigo-600/30 group-hover:text-indigo-600 dark:text-indigo-400/30 dark:group-hover:text-indigo-400 transition">
                          0{idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {t.category}
                          </span>
                          <h3 className="mt-0.5 font-serif text-sm font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition">
                            {t.title}
                          </h3>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {timeAgo(t.published_at)} · {estimateReadTime(t)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-6 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500 dark:bg-ink-950 dark:text-slate-400">
                <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Editorial Standards
                </p>
                <p className="mt-1">Every dispatch cites verified primary sources and passes automated quality gates.</p>
              </div>
            </aside>
          </section>
        )}

        {/* Top Stories Grid */}
        {rest.length > 0 && (
          <section className="mb-14" aria-label="Top stories">
            <AdSenseBanner className="mb-8" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Latest Dispatches</h2>
              <span className="text-xs font-medium text-slate-400">{rest.length} stories</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <Link key={a.id} to={`/a/${a.slug}`} className="card-3d group flex flex-col overflow-hidden !p-0">
                  <EditorialImage
                    src={a.featured_image_url}
                    alt={a.image_alt || a.title}
                    category={a.category}
                  />
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {a.category}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-500" />
                      </div>
                      <h3 className="mt-2 font-serif text-lg font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 transition">
                        {a.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {a.excerpt}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                      <ArticleMetaRow article={a} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Category Sections (when viewing all categories and not searching) */}
        {!cat && !search && byCategory.length > 1 && (
          <div className="space-y-12 border-t border-slate-200/80 pt-10 dark:border-slate-800">
            {byCategory.map(([categoryName, items]) => (
              <section key={categoryName} aria-label={`${categoryName} section`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {categoryName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCat(categoryName)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View all {categoryName} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.slice(0, 3).map((a) => (
                    <Link key={a.id} to={`/a/${a.slug}`} className="card group flex flex-col justify-between hover:border-indigo-500/40">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {a.category}
                        </span>
                        <h3 className="mt-1 font-serif text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                          {a.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{a.excerpt}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <ArticleMetaRow article={a} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !filtered.length && (
          <EmptyState
            title={search ? `No stories matching "${search}"` : "No articles published yet"}
            description={search ? "Try clearing your search filter or browsing another section." : "New stories will appear here automatically once published."}
            action={search && <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Clear search</Button>}
          />
        )}

        {/* Load More Pagination */}
        {data.page < data.pages && (
          <div className="mt-12 text-center">
            <Button variant="ghost" size="lg" loading={loading} onClick={() => load(data.page + 1, true)}>
              Load more stories
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
