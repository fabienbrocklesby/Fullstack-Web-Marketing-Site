export interface SitemapEntry {
  loc: string;
  lastmod?: string | Date;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  alternates?: Array<{ hreflang: string; href: string }>;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';

const SITEMAPINDEX_OPEN =
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

const formatDate = (value: string | Date | number) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return new Date(value).toISOString();
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const buildUrlSet = (entries: SitemapEntry[]) => {
  const urls = entries
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) {
        parts.push(`<lastmod>${formatDate(entry.lastmod)}</lastmod>`);
      }
      if (entry.changefreq) {
        parts.push(`<changefreq>${entry.changefreq}</changefreq>`);
      }
      if (typeof entry.priority === "number") {
        parts.push(`<priority>${entry.priority.toFixed(1)}</priority>`);
      }
      if (entry.alternates?.length) {
        for (const alt of entry.alternates) {
          parts.push(
            `<xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`,
          );
        }
      }
      return `  <url>\n    ${parts.join("\n    ")}\n  </url>`;
    })
    .join("\n");

  const body = urls ? `\n${urls}\n` : "\n";
  return `${XML_HEADER}\n${URLSET_OPEN}${body}</urlset>`;
};

export const buildSitemapIndex = (entries: SitemapEntry[]) => {
  const urls = entries
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) {
        parts.push(`<lastmod>${formatDate(entry.lastmod)}</lastmod>`);
      }
      return `  <sitemap>\n    ${parts.join("\n    ")}\n  </sitemap>`;
    })
    .join("\n");

  const body = urls ? `\n${urls}\n` : "\n";
  return `${XML_HEADER}\n${SITEMAPINDEX_OPEN}${body}</sitemapindex>`;
};
