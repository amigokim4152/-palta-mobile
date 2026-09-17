import {
  renderBusinessSitemapXml,
  renderPublicBusinessHtml,
  type PublicBusinessPageContent,
} from './publicBusinessWebRenderer.js';
import type { PublicBusinessWebProjection } from './publicBusinessWebProjection.js';

export type PublicBusinessStaticPage = Readonly<{
  projection: PublicBusinessWebProjection;
  content: PublicBusinessPageContent;
}>;

export type PublicBusinessStaticBundle = Readonly<{
  files: Readonly<Record<string, string>>;
  pageCount: number;
  sitemapCount: number;
}>;

function pathForProjection(projection: PublicBusinessWebProjection): string {
  const clean = projection.canonicalPath.replace(/^\/+|\/+$/g, '');
  if (!clean) throw new Error('Static Business page requires a canonical path');
  if (clean.includes('..')) throw new Error('Static Business path traversal is not allowed');
  return `${clean}/index.html`;
}

/**
 * Builds deployable static files without coupling Local Business to Next.js,
 * Cloudflare or another web framework. A hosting adapter may write these files
 * to Pages/R2/object storage, while canonical SEO rules stay in the domain.
 */
export function buildPublicBusinessStaticBundle(
  pages: readonly PublicBusinessStaticPage[],
): PublicBusinessStaticBundle {
  const files: Record<string, string> = {};
  const sitemapProjections: PublicBusinessWebProjection[] = [];
  const seenCanonicalUrls = new Set<string>();

  for (const page of pages) {
    const canonicalUrl = page.projection.canonicalUrl;
    if (seenCanonicalUrls.has(canonicalUrl)) {
      throw new Error(`Duplicate canonical Business page in static bundle: ${canonicalUrl}`);
    }
    seenCanonicalUrls.add(canonicalUrl);

    const outputPath = pathForProjection(page.projection);
    if (files[outputPath] !== undefined) {
      throw new Error(`Duplicate static Business output path: ${outputPath}`);
    }

    files[outputPath] = renderPublicBusinessHtml(page);
    if (page.projection.sitemapEligible && page.projection.robots === 'index,follow') {
      sitemapProjections.push(page.projection);
    }
  }

  files['sitemap-businesses.xml'] = renderBusinessSitemapXml(sitemapProjections);

  return {
    files,
    pageCount: pages.length,
    sitemapCount: sitemapProjections.length,
  };
}
