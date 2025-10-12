import type { APIContext } from "astro";
import { buildUrlSet } from "../utils/sitemap";
import { getOrigin, getStaticEntries } from "../utils/sitemap-data";

export const prerender = false;

export async function GET({ site }: APIContext) {
  const origin = getOrigin(site);
  const entries = getStaticEntries(origin);
  const xml = buildUrlSet(entries);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
