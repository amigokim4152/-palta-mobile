const CACHE_MS = 20 * 60 * 1000;
const BENEFITS_URL = 'https://vitacura.cl/vecinos/beneficios-sociales/';
const NEWS_URL = 'https://vitacura.cl/noticias/';

let benefitsCache = null;
let newsCache = null;

const MONTHS = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return undefined;
}

function extractTitle(html) {
  return (
    extractMeta(html, 'og:title') ??
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  ).replace(/\s+[–-]\s+Vitacura\s*$/i, '').trim();
}

function extractDescription(html) {
  return extractMeta(html, 'og:description') ?? extractMeta(html, 'description');
}

function parseSpanishPublishedAt(html) {
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (timeMatch?.[1]) {
    const parsed = Date.parse(timeMatch[1]);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  const text = stripHtml(html).toLowerCase();
  const match = text.match(
    /publicado\s+el\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(\d{1,2}),?\s+(\d{4})/i,
  );
  if (!match) return undefined;
  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return undefined;
  return new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString();
}

function extractNewsLinks(html) {
  const links = [];
  const seen = new Set();
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchor.exec(html))) {
    const href = match[1];
    if (!href || !/\/noticias\//i.test(href)) continue;
    let url;
    try {
      url = new URL(href, NEWS_URL).toString();
    } catch {
      continue;
    }
    if (url.replace(/\/$/, '') === NEWS_URL.replace(/\/$/, '')) continue;
    if (seen.has(url)) continue;
    const title = stripHtml(match[2]);
    if (title.length < 12 || /^ver\s+m[aá]s$/i.test(title) || /^leer\s+m[aá]s$/i.test(title)) continue;
    seen.add(url);
    links.push({ url, title });
    if (links.length >= 8) break;
  }
  return links;
}

async function fetchText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'SomosPaltaDevelopment/0.1 (+https://somospalta.cl)',
    },
  });
  if (!response.ok) throw new Error(`Vitacura HTTP ${response.status}: ${url}`);
  return response.text();
}

export async function getVitacuraBenefitsSource({ now = new Date() } = {}) {
  if (benefitsCache && benefitsCache.expiresAt > now.getTime()) return benefitsCache.value;
  const observedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CACHE_MS).toISOString();

  try {
    const html = await fetchText(BENEFITS_URL);
    const text = stripHtml(html);
    if (!/beneficios\s+sociales/i.test(text)) throw new Error('Benefits marker missing');

    const description =
      extractDescription(html) ??
      'Vitacura mantiene programas municipales de apoyo social. Revisa cada programa antes de postular, porque los requisitos varían.';

    const value = {
      sourceState: {
        source_domain: 'public-life',
        data_mode: 'scheduled',
        observed_at: observedAt,
        expires_at: expiresAt,
      },
      item: {
        id: 'public-life-vitacura-benefits-directory',
        kind: 'useful_today',
        title: 'Beneficios sociales de Vitacura',
        body: description.slice(0, 220),
        source_domain: 'public-life',
        delivery: 'home',
        related_entity_id: BENEFITS_URL,
        action_label: 'Ver beneficios',
        action_target: BENEFITS_URL,
        action_kind: 'external',
      },
    };
    benefitsCache = { expiresAt: now.getTime() + CACHE_MS, value };
    return value;
  } catch (error) {
    return {
      sourceState: {
        source_domain: 'public-life',
        data_mode: 'unavailable',
        observed_at: observedAt,
        message: error instanceof Error ? error.message : 'Vitacura benefits unavailable',
      },
      item: null,
    };
  }
}

export async function getVitacuraNewsSource({ now = new Date(), maxItems = 3 } = {}) {
  if (newsCache && newsCache.expiresAt > now.getTime()) return newsCache.value;
  const observedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + CACHE_MS).toISOString();

  try {
    const listingHtml = await fetchText(NEWS_URL);
    const links = extractNewsLinks(listingHtml);
    if (links.length === 0) throw new Error('No news links discovered');

    const records = [];
    for (const link of links.slice(0, 6)) {
      try {
        const html = await fetchText(link.url);
        const publishedAt = parseSpanishPublishedAt(html);
        if (!publishedAt) continue;
        const title = extractTitle(html) || link.title;
        const summary = extractDescription(html);
        const age = now.getTime() - Date.parse(publishedAt);
        if (age < 0 || age > 72 * 60 * 60 * 1000) continue;
        records.push({
          id: link.url,
          title,
          ...(summary ? { body: summary.slice(0, 220) } : {}),
          publishedAt,
          source_domain: 'news',
          kind: 'content',
          delivery: 'home',
          related_entity_id: link.url,
          action_label: 'Leer fuente',
          action_target: link.url,
          action_kind: 'external',
        });
        if (records.length >= maxItems) break;
      } catch {
        // One malformed article must not poison the whole listing.
      }
    }

    const value = {
      sourceState: {
        source_domain: 'news',
        data_mode: 'scheduled',
        observed_at: observedAt,
        expires_at: expiresAt,
      },
      items: records.map(({ publishedAt: _publishedAt, ...item }) => item),
    };
    newsCache = { expiresAt: now.getTime() + CACHE_MS, value };
    return value;
  } catch (error) {
    return {
      sourceState: {
        source_domain: 'news',
        data_mode: 'unavailable',
        observed_at: observedAt,
        message: error instanceof Error ? error.message : 'Vitacura news unavailable',
      },
      items: [],
    };
  }
}
