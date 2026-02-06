import { getAllPosts } from "../../lib/strapi";

export const prerender = true;

export async function GET({ site }) {
  const posts = await getAllPosts(50);
  const base = site?.href || "";
  const items = posts
    .map((p) => {
      const url = base
        ? new URL(`/blog/${p.slug}`, base).href
        : `/blog/${p.slug}`;
      const description = (p.preview || p.excerpt || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;");
      return `<item>
<title><![CDATA[${p.title}]]></title>
<link>${url}</link>
<guid>${url}</guid>
<pubDate>${new Date(p.date).toUTCString()}</pubDate>
<description><![CDATA[${description}]]></description>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Light Lane Blog</title>
<link>${base ? new URL("/blog", base).href : "/blog"}</link>
<description>Latest insights and tutorials about SaaS development</description>
<language>en</language>
<atom:link href="${base ? new URL("/blog/rss.xml", base).href : "/blog/rss.xml"}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
