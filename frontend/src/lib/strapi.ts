/**
 * Simple Strapi CMS helper functions for blog content.
 * Supports fields: title, slug, content (HTML), date, author name.
 * Designed to fail gracefully (returns empty array / null if unreachable) so builds don't break if CMS is down.
 */

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string; // sanitized/processed HTML (richtext -> HTML)
  date: string; // ISO string
  author: string; // simple string field in content-type
  preview?: string; // explicit preview/summary from Strapi
  excerpt?: string; // derived short text
  coverImageUrl?: string;
  coverImageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonical?: string;
}

import MarkdownIt from "markdown-it";

const DEFAULT_CMS_URL = "http://localhost:1337";
let CMS_URL: string = DEFAULT_CMS_URL; // API base used for server fetches (SSR)
let PUBLIC_CMS_URL: string | undefined; // Public base used for media URLs in rendered HTML
let CMS_TOKEN: string | undefined;

// Try to get server-side env vars first (for SSR), then fall back to PUBLIC_ vars
try {
  // For server-side (SSR), check process.env first for non-PUBLIC variables
  // This allows different URLs for internal Docker networking vs external API
  const nodeEnv = (globalThis as any)?.process?.env;
  if (nodeEnv) {
    if (nodeEnv.STRAPI_URL) {
      CMS_URL = nodeEnv.STRAPI_URL;
    } else if (nodeEnv.PUBLIC_STRAPI_URL) {
      CMS_URL = nodeEnv.PUBLIC_STRAPI_URL;
    }

    // Prefer explicitly provided public URL for media
    if (nodeEnv.PUBLIC_STRAPI_URL) {
      PUBLIC_CMS_URL = nodeEnv.PUBLIC_STRAPI_URL;
    }

    if (nodeEnv.STRAPI_API_TOKEN) {
      CMS_TOKEN = nodeEnv.STRAPI_API_TOKEN;
    } else if (nodeEnv.PUBLIC_STRAPI_API_TOKEN) {
      CMS_TOKEN = nodeEnv.PUBLIC_STRAPI_API_TOKEN;
    }
  }

  // Fallback to import.meta.env for PUBLIC_ vars (works both SSR and client-side)
  if (!CMS_URL || CMS_URL === DEFAULT_CMS_URL) {
    const envObj = (import.meta as any)?.env || {};
    if (envObj.PUBLIC_STRAPI_URL) {
      CMS_URL = envObj.PUBLIC_STRAPI_URL;
    }
    if (!CMS_TOKEN && envObj.PUBLIC_STRAPI_API_TOKEN) {
      CMS_TOKEN = envObj.PUBLIC_STRAPI_API_TOKEN;
    }

    // Also set public base for media if available
    if (envObj.PUBLIC_STRAPI_URL) {
      PUBLIC_CMS_URL = envObj.PUBLIC_STRAPI_URL;
    }
  }
} catch { }

function absolutizeMedia(html: string, base: string): string {
  if (!html) return html;
  // Replace src="/uploads/... and src='/uploads/... with absolute URL
  return html.replace(
    /src=("|')\/?uploads\//g,
    (m, q) => `src=${q}${base.replace(/\/$/, "")}/uploads/`,
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function makeExcerpt(html: string, max = 180): string {
  const text = stripHtml(html);
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (
    (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim() + "…"
  );
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

function renderRich(contentRaw: string): string {
  if (!contentRaw) return "";
  const trimmed = contentRaw.trim();
  const looksMarkdown =
    /(^|\s)([#>*_`-]|\d+\.)/.test(trimmed) ||
    /\*\*[\s\S]+?\*\*/.test(trimmed) ||
    /__[^_]+__/.test(trimmed);
  // If we only have a single wrapping <p> ... </p>, strip it for markdown processing
  const singleParagraphWrap =
    /^<p>[\s\S]*<\/p>$/.test(trimmed) &&
    (trimmed.match(/<p>/g) || []).length === 1;
  const hasOtherHtml = /<[^>]+>/.test(
    trimmed.replace(/^<p>|<\/p>$/g, "").replace(/<br\s*\/?>/gi, ""),
  );
  if (looksMarkdown) {
    if (!hasOtherHtml) {
      const candidate = singleParagraphWrap
        ? trimmed.replace(/^<p>|<\/p>$/g, "")
        : trimmed;
      return md.render(candidate);
    }
  }
  return contentRaw;
}

function normalizePost(raw: any): Post | null {
  if (!raw?.id || !raw?.attributes) return null;
  const a = raw.attributes;
  const authorName =
    typeof a.author === "string" && a.author.trim().length > 0
      ? a.author
      : "Unknown";
  let contentRaw = a.content || "";
  contentRaw = renderRich(contentRaw);
  const hasBlockTags =
    /<\s*(p|div|h[1-6]|ul|ol|li|img|blockquote|pre|code|section|article|figure|br)\b/i.test(
      contentRaw,
    );
  if (!hasBlockTags) {
    const paragraphs: string[] = contentRaw
      .split(/\n{2,}/)
      .map((seg: string) => seg.trim())
      .filter(Boolean) as string[];
    contentRaw = paragraphs
      .map((p: string) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
      .join("\n");
  }
  const mediaBase = (PUBLIC_CMS_URL || CMS_URL).replace(/\/$/, "");
  const contentHtml = absolutizeMedia(contentRaw, mediaBase);
  const preview: string | undefined = a.preview || undefined;
  // cover image extraction
  let coverImageUrl: string | undefined;
  let coverImageAlt: string | undefined;
  const cover = a.coverImage || a.cover_image || a.thumbnail;
  const coverData = cover?.data;
  const coverAttr = coverData?.attributes;
  if (coverAttr?.url) {
    coverImageUrl = coverAttr.url.startsWith("http")
      ? coverAttr.url
      : `${mediaBase}${coverAttr.url}`;
    coverImageAlt =
      coverAttr.alternativeText || coverAttr.name || a.title || "Cover image";
  }
  return {
    id: raw.id,
    title: a.title ?? "Untitled",
    slug: a.slug ?? String(raw.id),
    content: contentHtml,
    date:
      a.publishedAt || a.updatedAt || a.createdAt || new Date().toISOString(),
    author: authorName,
    preview,
    excerpt: preview ? preview : makeExcerpt(contentHtml),
    coverImageUrl,
    coverImageAlt,
    seoTitle: a.seoTitle || a.seo_title || undefined,
    seoDescription:
      a.seoDescription || a.seo_description || preview || undefined,
    canonical: a.slug ? `/blog/${a.slug}` : undefined,
  };
}

async function safeFetch(url: string): Promise<any | null> {
  try {
    const headers: Record<string, string> = {};
    if (CMS_TOKEN) headers["Authorization"] = `Bearer ${CMS_TOKEN}`;
    const res = await fetch(url, {
      headers,
      cache: 'no-store' // Disable caching to always fetch fresh data
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[Strapi] ${url} -> HTTP ${res.status} ${res.statusText} body:`,
        text.slice(0, 200),
      );
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("[Strapi] fetch error:", (e as Error).message, "URL:", url);
    return null;
  }
}

const COLLECTION_ENDPOINTS = ["blogposts", "blogpost", "posts", "articles"];

async function fetchFirstAvailable(pathBuilder: (ep: string) => string) {
  for (const ep of COLLECTION_ENDPOINTS) {
    const url = pathBuilder(ep);
    const json = await safeFetch(url);
    if (json?.data) {
      if (Array.isArray(json.data) && json.data.length === 0) continue; // try next if empty
      return json;
    }
  }
  return null;
}

// Variant that allows empty arrays (for pagination pages beyond last we need meta)
async function fetchFirstAvailableAllowEmpty(
  pathBuilder: (ep: string) => string,
) {
  for (const ep of COLLECTION_ENDPOINTS) {
    const url = pathBuilder(ep);
    const json = await safeFetch(url);
    if (json && "data" in json) return json; // even if empty array
  }
  return null;
}

export async function getAllPosts(limit = 100): Promise<Post[]> {
  const json = await fetchFirstAvailable(
    (ep) =>
      `${CMS_URL}/api/${ep}?sort=publishedAt:desc&pagination[pageSize]=${limit}&populate=coverImage`,
  );
  if (!json?.data) return [];
  return json.data.map(normalizePost).filter(Boolean) as Post[];
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const json = await fetchFirstAvailable(
    (ep) =>
      `${CMS_URL}/api/${ep}?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=coverImage`,
  );
  if (!json?.data?.length) return null;
  return normalizePost(json.data[0]);
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export async function getPaginatedPosts(
  page = 1,
  pageSize = 9,
): Promise<{ posts: Post[]; pagination: PaginationInfo }> {
  const safePage = page < 1 ? 1 : page;
  const json = await fetchFirstAvailableAllowEmpty(
    (ep) =>
      `${CMS_URL}/api/${ep}?sort=publishedAt:desc&pagination[page]=${safePage}&pagination[pageSize]=${pageSize}&populate=coverImage`,
  );
  const posts =
    (json?.data?.map(normalizePost).filter(Boolean) as Post[]) || [];
  const meta = json?.meta?.pagination || {
    page: safePage,
    pageSize,
    pageCount: posts.length ? 1 : 0,
    total: posts.length,
  };
  return { posts, pagination: meta };
}

export { CMS_URL, CMS_TOKEN, PUBLIC_CMS_URL };
