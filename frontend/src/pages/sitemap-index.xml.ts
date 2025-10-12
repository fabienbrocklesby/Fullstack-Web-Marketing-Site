import type { APIContext } from "astro";
import { buildSitemapIndex } from "../utils/sitemap";
import {
  getBlogLatestDate,
  getDynamicPagesLatestDate,
  getOrigin,
} from "../utils/sitemap-data";

const buildTimestamp = new Date();

export const prerender = false;

export async function GET({ site }: APIContext) {
  const origin = getOrigin(site);

  const [blogLastmod, dynamicLastmod] = await Promise.all([
    getBlogLatestDate(),
    getDynamicPagesLatestDate(),
  ]);

  const indexEntries = [
    {
      loc: new URL("/sitemap-static.xml", origin).href,
      lastmod: buildTimestamp,
    },
    {
      loc: new URL("/sitemap-blog.xml", origin).href,
      lastmod: blogLastmod ?? buildTimestamp,
    },
    {
      loc: new URL("/sitemap-pages.xml", origin).href,
      lastmod: dynamicLastmod ?? buildTimestamp,
    },
  ];

  const xml = buildSitemapIndex(indexEntries);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
