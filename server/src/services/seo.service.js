const SITE_NAME = "World News";

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function buildArticleSchemas(article, siteUrl) {
  const site = (siteUrl || "https://worldnews.business").replace(/\/$/, "");
  const articleUrl = `${site}/a/${article.slug}`;
  const category = article.category || "News";
  const categoryUrl = `${site}/?category=${encodeURIComponent(category)}`;

  const newsArticle = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    headline: article.title,
    description: article.meta_description || article.excerpt || "",
    image: article.featured_image_url ? [article.featured_image_url] : undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    articleSection: category,
    author: {
      "@type": "Organization",
      name: `${SITE_NAME} Newsroom`,
      url: site,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: site,
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${site}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category,
        item: categoryUrl,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };

  const schemas = [newsArticle, breadcrumb];

  const validFaqs = Array.isArray(article.faqs)
    ? article.faqs.filter((f) => f && String(f.question || "").trim() && String(f.answer || "").trim())
    : [];

  if (validFaqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: validFaqs.map((f) => ({
        "@type": "Question",
        name: String(f.question).trim(),
        acceptedAnswer: {
          "@type": "Answer",
          text: String(f.answer).trim(),
        },
      })),
    });
  }

  return schemas;
}

export function injectArticleSeo(html, article, siteUrl) {
  const site = (siteUrl || "https://worldnews.business").replace(/\/$/, "");
  const articleUrl = `${site}/a/${article.slug}`;
  const rawTitle = `${article.meta_title || article.title} | ${SITE_NAME}`;
  const rawDesc = article.meta_description || article.excerpt || "";
  const title = escapeHtml(rawTitle);
  const desc = escapeHtml(rawDesc);
  const url = escapeHtml(articleUrl);

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${desc}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="article" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${desc}" />`);

  const extraTags = [];
  if (article.featured_image_url) {
    const img = escapeHtml(article.featured_image_url);
    extraTags.push(`<meta property="og:image" content="${img}" />`);
    extraTags.push(`<meta name="twitter:image" content="${img}" />`);
  }
  if (article.published_at) {
    extraTags.push(`<meta property="article:published_time" content="${escapeHtml(article.published_at)}" />`);
  }
  if (article.category) {
    extraTags.push(`<meta property="article:section" content="${escapeHtml(article.category)}" />`);
  }

  const schemas = buildArticleSchemas(article, site);
  for (const schema of schemas) {
    extraTags.push(`<script type="application/ld+json">${safeJsonLd(schema)}</script>`);
  }

  return out.replace(/<\/head>/i, `    ${extraTags.join("\n    ")}\n  </head>`);
}

export function injectPageSeo(html, { title, description, url }) {
  let out = html;
  if (title) {
    const t = escapeHtml(title);
    out = out
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`)
      .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${t}" />`)
      .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${t}" />`);
  }
  if (description) {
    const d = escapeHtml(description);
    out = out
      .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${d}" />`)
      .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${d}" />`)
      .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${d}" />`);
  }
  if (url) {
    const u = escapeHtml(url);
    out = out
      .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${u}" />`)
      .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${u}" />`);
  }
  return out;
}
