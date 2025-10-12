import type { APIContext } from "astro";
import { getOrigin } from "../utils/sitemap-data";

export const prerender = false;

export async function GET({ site }: APIContext) {
  const origin = getOrigin(site);
  const target = new URL("/sitemap-index.xml", origin).href;

  return new Response(null, {
    status: 308,
    headers: {
      Location: target,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
