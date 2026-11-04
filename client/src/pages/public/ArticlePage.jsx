import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Clock, BookOpen, ShieldCheck, Share2, Link2, Check,
  ExternalLink, ChevronDown, ListOrdered, Sparkles
} from "lucide-react";
import { api, fmt } from "../../api.js";
import {
  Badge, Button, EditorialImage, Skeleton, EmptyState,
  useToast, timeAgo, estimateReadTime, AdSenseBanner
} from "../../components/ui.jsx";
import { Header, Footer, SITE, SITE_URL, setSeoMeta } from "./Home.jsx";

function parseHtmlAndInjectIds(html = "") {
  const headings = [];
  let idx = 0;
  const processed = html.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    const plain = inner.replace(/<[^>]+>/g, "").trim();
    const id = `section-${++idx}-${plain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
    headings.push({ id, text: plain, level: tag.toLowerCase() });
    return `<${tag}${attrs} id="${id}" class="scroll-mt-24">${inner}</${tag}>`;
  });
  return { html: processed, headings };
}

export default function ArticlePage() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [a, setA] = useState(null);
  const [related, setRelated] = useState([]);
  const [cats, setCats] = useState([]);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setA(null);
    setErr("");
    api("/public/categories").then(setCats).catch(() => {});
    api(`/public/articles/${slug}`)
      .then((x) => {
        setA(x);
        setSeoMeta({
          title: `${x.meta_title || x.title} | ${SITE}`,
          description: x.meta_description || x.excerpt || "",
          url: `${SITE_URL}/a/${x.slug}`,
          image: x.featured_image_url || undefined,
          type: "article",
        });
      })
      .catch(() => setErr("Article not found."));

    api("/public/articles?page=1")
      .then((d) => setRelated((d.articles || []).filter((item) => item.slug !== slug).slice(0, 3)))
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) return setProgress(0);
      setProgress(Math.min(100, Math.max(0, Math.round((el.scrollTop / total) * 100))));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { html: contentWithIds, headings } = useMemo(
    () => parseHtmlAndInjectIds(a?.content_html || ""),
    [a?.content_html]
  );

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("Article link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast("Could not copy link", "error");
    }
  };

  if (err) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header categories={cats} />
        <main className="mx-auto max-w-3xl flex-1 px-4 py-20">
          <EmptyState
            title="Article not found"
            description="The story you are looking for may have been moved or unpublished."
            action={<Link to="/"><Button variant="primary">← Back to Top News</Button></Link>}
          />
        </main>
        <Footer />
      </div>
    );
  }

  if (!a) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header categories={cats} />
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-12">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="aspect-video w-full rounded-3xl" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    description: a.meta_description,
    image: a.featured_image_url ? [a.featured_image_url] : undefined,
    datePublished: a.published_at,
    dateModified: a.updated_at || a.published_at,
    publisher: { "@type": "Organization", name: SITE },
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Reading Progress Bar */}
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        />
      </div>

      <Header categories={cats} activeCategory={a.category} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {/* Top Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" /> All Dispatches
          </Link>
          <Badge tone="brand" className="uppercase tracking-widest">{a.category}</Badge>
        </div>

        {/* Article Header */}
        <header className="mx-auto max-w-[68ch]">
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {a.title}
          </h1>
          {a.excerpt && (
            <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              {a.excerpt}
            </p>
          )}

          {/* Byline, Dates, Read Time & Share Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200/80 py-4 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span>By {SITE} Newsroom</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" /> AI-assisted, editorially reviewed
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Published {fmt(a.published_at)}
                </span>
                {a.updated_at && a.updated_at !== a.published_at && (
                  <span>· Updated {timeAgo(a.updated_at)}</span>
                )}
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" /> {estimateReadTime(a)}
                </span>
                {a.sources?.length > 0 && (
                  <>
                    <span>·</span>
                    <a href="#article-sources" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {a.sources.length} verified sources
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                title="Copy article link"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(a.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                title="Share on X"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </a>
            </div>
          </div>
        </header>

        {/* Featured Editorial Image */}
        <figure className="my-8 overflow-hidden rounded-3xl shadow-elev-3">
          <EditorialImage
            src={a.featured_image_url}
            alt={a.image_alt || a.title}
            category={a.category}
            priority
          />
          <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 px-5 py-2.5 text-xs text-slate-500 dark:bg-ink-900 dark:text-slate-400">
            <span>{a.image_alt || a.title}</span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">AI-generated image</span>
          </figcaption>
        </figure>

        {/* Readable Article Column (65-75ch) + Table of Contents */}
        <div className="mx-auto max-w-[68ch]">
          {headings.length >= 2 && (
            <nav
              aria-label="Table of contents"
              className="mb-8 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-ink-900/70"
            >
              <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <ListOrdered className="h-4 w-4 text-indigo-500" /> In This Dispatch
              </p>
              <ol className="space-y-1.5 text-sm">
                {headings.map((h, i) => (
                  <li key={h.id} className={h.level === "h3" ? "pl-4" : ""}>
                    <a
                      href={`#${h.id}`}
                      className="text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition"
                    >
                      <span className="mr-2 font-mono text-xs text-indigo-500">{i + 1}.</span>
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Main Story Body */}
          <div
            className="prose prose-slate prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-bold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-blockquote:border-indigo-500"
            dangerouslySetInnerHTML={{ __html: contentWithIds }}
          />
          <AdSenseBanner className="mt-8" />

          {/* AI-Assisted Editorial Disclosure Box */}
          <div className="mt-10 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-500" /> Editorial Transparency & Verification
            </p>
            <p className="mt-1">
              This report was drafted with AI-assisted research and verified against {a.sources?.length || "multiple"} cited external sources before publication. All facts and links below were checked at publication time.
            </p>
          </div>

          {/* FAQ Accordion */}
          {a.faqs?.length > 0 && (
            <section className="mt-10" aria-label="Frequently asked questions">
              <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
                Frequently Asked Questions
              </h2>
              <div className="mt-4 space-y-3">
                {a.faqs.map((f, i) => (
                  <details
                    key={i}
                    className="group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-elev-1 dark:border-slate-800 dark:bg-ink-900"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 dark:text-white">
                      <span>{f.question}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {f.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Sources List with Count */}
          {a.sources?.length > 0 && (
            <section id="article-sources" className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Verified Sources & Citations ({a.sources.length})
                </h3>
                <Badge tone="PUBLISHED">{a.sources.length} Sources Checked</Badge>
              </div>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {a.sources.map((s, i) => {
                  let host = "Source";
                  try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch {}
                  return (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener nofollow noreferrer"
                        className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs transition hover:border-indigo-500/50 hover:shadow-elev-1 dark:border-slate-800 dark:bg-ink-900"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 line-clamp-1 dark:text-slate-100">{s.title || host}</p>
                          <p className="mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400">{host}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* Related Articles */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-slate-200 pt-10 dark:border-slate-800" aria-label="Related stories">
            <h2 className="mb-6 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              More From {SITE}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link key={item.id} to={`/a/${item.slug}`} className="card-3d group flex flex-col overflow-hidden !p-0">
                  <EditorialImage
                    src={item.featured_image_url}
                    alt={item.image_alt || item.title}
                    category={item.category}
                  />
                  <div className="p-5">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {item.category}
                    </span>
                    <h3 className="mt-1.5 font-serif text-base font-bold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">{timeAgo(item.published_at)} · {estimateReadTime(item)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
