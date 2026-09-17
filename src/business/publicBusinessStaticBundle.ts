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

function isPublishableStaticPage(projection: PublicBusinessWebProjection): boolean {
  return projection.sitemapEligible && projection.robots === 'index,follow';
}

/**
 * Builds deployable static files without coupling Local Business to Next.js,
 * Cloudflare or another web framework. A hosting adapter may write these files
 * to Pages/R2/object storage, while canonical SEO rules stay in the domain.
 *
 * `noindex` is not a privacy boundary, so draft/duplicate/invalid projections
 * are not emitted into the static bundle at all.
 */
export function buildPublicBusinessStaticBundle(
  pages: readonly PublicBusinessStaticPage[],
): PublicBusinessStaticBundle {
  const files: Record<string, string> = {};
  const sitemapProjections: PublicBusinessWebProjection[] = [];
  const seenCanonicalUrls = new Set<string>();
  let pageCount = 0;

  for (const page of pages) {
    if (!isPublishableStaticPage(page.projection)) continue;

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
    sitemapProjections.push(page.projection);
    pageCount += 1;
  }

  files['sitemap-businesses.xml'] = renderBusinessSitemapXml(sitemapProjections);

  return {
    files,
    pageCount,
    sitemapCount: sitemapProjections.length,
  };
}
