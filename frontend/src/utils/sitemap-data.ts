import type { SitemapEntry } from "./sitemap";
import { getAllPosts } from "../lib/strapi";

const DEFAULT_SITE = "https://lightlane.app/";
const buildTimestamp = new Date();

const getEnv = () => {
  const env =
    // @ts-ignore Astro injects env at build time
    (import.meta.env as Record<string, string | undefined>) || {};
  return env;
};

const getCmsConfig = () => {
  const env = getEnv();
  let url = env.PUBLIC_STRAPI_URL || "http://localhost:1337";
  url = url.replace(/\/$/, "");
  const token = env.PUBLIC_STRAPI_API_TOKEN;
  return { url, token };
};

async function fetchJson<T>(url: string, token?: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface StrapiPageResponse {
  data: Array<{
    id: number;
    attributes?: {
      slug?: string;
      updatedAt?: string;
      locale?: string;
    };
  }>;
  meta?: { pagination?: { pageCount?: number; page?: number } };
}

export const getOrigin = (site?: URL | string | null) =>
  site ? new URL(site.toString()).href : DEFAULT_SITE;

const STATIC_ROUTES: Array<{
  path: string;
  changefreq: SitemapEntry["changefreq"];
  priority: number;
}> = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/pricing", changefreq: "daily", priority: 0.9 },
  { path: "/contact", changefreq: "monthly", priority: 0.6 },
  { path: "/blog", changefreq: "daily", priority: 0.8 },
  { path: "/blog/page/2", changefreq: "weekly", priority: 0.5 },
  { path: "/join", changefreq: "monthly", priority: 0.4 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
  { path: "/eula", changefreq: "yearly", priority: 0.2 },
  { path: "/cookies", changefreq: "yearly", priority: 0.2 },
  { path: "/login", changefreq: "monthly", priority: 0.4 },
  { path: "/register", changefreq: "monthly", priority: 0.4 },
  { path: "/customer/login", changefreq: "monthly", priority: 0.4 },
  { path: "/customer/register", changefreq: "monthly", priority: 0.4 },
  { path: "/success", changefreq: "yearly", priority: 0.3 },
  { path: "/license-portal", changefreq: "monthly", priority: 0.5 },
];

export const getStaticEntries = (origin: string): SitemapEntry[] =>
  STATIC_ROUTES.map((item) => ({
    loc: new URL(item.path, origin).href,
    changefreq: item.changefreq,
    priority: item.priority,
    lastmod: buildTimestamp,
  }));

export const getBlogEntries = async (origin: string): Promise<SitemapEntry[]> => {
  const posts = await getAllPosts(200);
  if (!posts.length) return [];
  return posts.map((post) => ({
    loc: new URL(`/blog/${post.slug}`, origin).href,
    lastmod: post.date,
    changefreq: "weekly",
    priority: 0.7,
  }));
};

export const getBlogLatestDate = async (): Promise<Date | null> => {
  const posts = await getAllPosts(10);
  if (!posts.length) return null;
  const latest = posts
    .map((post) => new Date(post.date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return latest[0] ?? null;
};

export const getDynamicPageEntries = async (
  origin: string,
): Promise<SitemapEntry[]> => {
  const { url, token } = getCmsConfig();
  const entries: SitemapEntry[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const query = `${url}/api/pages?fields[0]=slug&fields[1]=updatedAt&pagination[page]=${page}&pagination[pageSize]=100`;
    const json = await fetchJson<StrapiPageResponse>(query, token);
    if (!json?.data) break;

    for (const item of json.data) {
      const slug = item.attributes?.slug;
      if (!slug || slug === "home") continue;
      entries.push({
        loc: new URL(`/${slug}`, origin).href,
        lastmod: item.attributes?.updatedAt || buildTimestamp,
        changefreq: "monthly",
        priority: 0.5,
      });
    }

    totalPages = json.meta?.pagination?.pageCount ?? totalPages;
    page += 1;
  }
  return entries;
};

export const getDynamicPagesLatestDate = async (): Promise<Date | null> => {
  const { url, token } = getCmsConfig();
  const query = `${url}/api/pages?fields[0]=updatedAt&sort=updatedAt:desc&pagination[pageSize]=1`;
  const json = await fetchJson<StrapiPageResponse>(query, token);
  const date = json?.data?.[0]?.attributes?.updatedAt;
  return date ? new Date(date) : null;
};
