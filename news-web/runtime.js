const FORBIDDEN_PUBLIC_FIELDS = new Set([
  'risk_flags',
  'editorial_state',
  'reviewer_notes',
  'ai_notes',
  'ai_processed',
  'raw_title',
  'source_excerpt',
  'fact_object',
  'verification_queue',
]);

const PUBLIC_API_PREFIX = '/v1/cl/news/';
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function assertSafeProjection(value) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_PUBLIC_FIELDS.has(key)) {
        throw new Error(`Campo editorial interno bloqueado: ${key}`);
      }
      stack.push(child);
    }
  }
}

function safeSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new Error('Ruta de noticia inválida.');
  return slug;
}

function apiPath(view, slug) {
  switch (view) {
    case 'home': return '/v1/cl/news/home';
    case 'local': return `/v1/cl/news/comunas/${safeSlug(slug)}`;
    case 'story':
    case 'deep-dive': return `/v1/cl/news/stories/${safeSlug(slug)}`;
    case 'voices': return '/v1/cl/news/voices';
    default: throw new Error('Vista de News no reconocida.');
  }
}

function querySlug(defaultSlug = '') {
  const value = new URLSearchParams(location.search).get('slug') || defaultSlug;
  return value ? safeSlug(value) : '';
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.reason ? ` · ${payload.reason}` : '';
    } catch {}
    throw new Error(`No se pudo cargar News (${response.status}${detail}).`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('News devolvió una respuesta que no es JSON.');
  }
  const payload = await response.json();
  assertSafeProjection(payload);
  return payload;
}

async function loadMockStory(slug) {
  const direct = await fetchJson('mock/story.json');
  if (!slug || direct.slug === slug) return direct;

  const home = await fetchJson('mock/home.json');
  for (const rows of Object.values(home.sections || {})) {
    const found = Array.isArray(rows) ? rows.find((item) => item.slug === slug) : null;
    if (found) return found;
  }
  throw new Error('No existe un detalle ficticio para esta noticia.');
}

async function loadPayload() {
  const body = document.body;
  const source = body.dataset.newsSource || 'disabled';
  const view = body.dataset.newsView || '';
  const slug = querySlug(body.dataset.newsSlug || '');

  if (source === 'mock') {
    if (view === 'story') return loadMockStory(slug);
    const mockPath = body.dataset.newsMock;
    if (!mockPath) throw new Error('Falta la ruta mock explícita.');
    return fetchJson(mockPath);
  }

  if (source === 'api') {
    const path = apiPath(view, slug);
    if (!path.startsWith(PUBLIC_API_PREFIX)) throw new Error('Ruta pública de News inválida.');
    return fetchJson(path);
  }

  throw new Error('La fuente de News no está habilitada para esta página.');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function placeLabel(geo = {}) {
  return geo.localityName || geo.comunaName || geo.regionName || 'Chile';
}

function storyHref(item) {
  if (!item?.slug) return '#';
  if (item.contentClass === 'deep_dive') return `deep-dive.html?slug=${encodeURIComponent(item.slug)}`;
  if (item.contentClass === 'local_voice') return 'voices.html';
  return `story.html?slug=${encodeURIComponent(item.slug)}`;
}

function actionHref(action) {
  const target = String(action?.target || '');
  if (target.startsWith('/') || target.startsWith('https://') || target.startsWith('palta://')) return target;
  return '#';
}

function card(item, extraClass = '') {
  return `<a class="card ${extraClass}" href="${escapeHtml(storyHref(item))}">
    <div class="meta"><span class="tag">${escapeHtml(item.topic || item.contentClass)}</span><span>${escapeHtml(placeLabel(item.geography))} · ${escapeHtml(formatDate(item.publishedAt))}</span></div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary)}</p>
  </a>`;
}

function brief(item) {
  return `<a class="brief" href="${escapeHtml(storyHref(item))}">
    <div class="brief-time">${escapeHtml(formatDate(item.publishedAt))}</div>
    <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div>
  </a>`;
}

function section(title, content, note = '') {
  if (!content) return '';
  return `<section class="section"><div class="section-head"><h2>${escapeHtml(title)}</h2>${note ? `<span class="section-note">${escapeHtml(note)}</span>` : ''}</div>${content}</section>`;
}

function gateNotice(payload, source) {
  if (source === 'mock') {
    return '<div class="notice">Datos ficticios de desarrollo. Esta página usa explícitamente el modo mock y no está conectada a publicación real.</div>';
  }
  if (payload?.publicationGate !== 'open') {
    return '<div class="notice">La proyección pública de News no está habilitada.</div>';
  }
  return '';
}

function renderHome(payload) {
  const s = payload.sections || {};
  const essential = [...(s.essential || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
  const nearby = [...(s.nearby || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 12);
  const local = [...(s.local || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 12);
  const chile = [...(s.chile || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 8);
  const deep = [...(s.deep_dive || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 4);
  const voices = [...(s.voices || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 4);

  let essentialHtml = '';
  if (essential.length) {
    const [lead, ...rest] = essential;
    essentialHtml = `<div class="lead">${card(lead, 'hero')}<div class="stack">${rest.map((x) => card(x)).join('')}</div></div>`;
  }

  return `${gateNotice(payload, document.body.dataset.newsSource)}
    ${section('Lo esencial', essentialHtml, 'Pocas cosas, bien escogidas')}
    ${section('Cerca de ti', nearby.length ? `<div class="brief-list">${nearby.map(brief).join('')}</div>` : '', 'Cambios con impacto cercano')}
    ${section('En tu comuna', local.length ? `<div class="grid2">${local.map((x) => card(x)).join('')}</div>` : '', 'Cambios y temas locales')}
    ${section('Chile', chile.length ? `<div class="grid2">${chile.map((x) => card(x)).join('')}</div>` : '', 'Solo cuando importa para tu vida')}
    ${section('En profundidad', deep.length ? deep.map((x) => card(x)).join('') : '', 'Contexto y seguimiento')}
    ${section('Voces locales', voices.length ? `<div class="grid2">${voices.map((x) => card(x, 'voice-card')).join('')}</div>` : '', 'Perspectivas claramente etiquetadas')}`;
}

function renderLocal(payload) {
  const current = payload.current || [];
  const briefs = payload.briefs || [];
  const mapped = [...current, ...briefs].filter((item) => item.mapContext?.status === 'verified');
  const topics = payload.trackedTopics || [];
  const links = payload.crossModuleLinks || [];
  const voices = payload.voices || [];

  const mast = document.querySelector('[data-news-mast-title]');
  const place = document.querySelector('[data-news-mast-place]');
  if (mast) mast.textContent = placeLabel(payload.geography);
  if (place) place.textContent = payload.heading || 'Noticias y cambios de tu comuna';
  document.title = `${placeLabel(payload.geography)} — Noticias`;

  const mapHtml = mapped.length
    ? `<div class="mapbox"><span class="map-label">${escapeHtml(mapped[0].mapContext.label)}</span></div>`
    : '<div class="card"><p>No hay ubicaciones verificadas para mostrar en este momento.</p></div>';

  const topicHtml = topics.map((topic) => `<a class="card" href="${topic.deepDiveSlug ? `deep-dive.html?slug=${encodeURIComponent(topic.deepDiveSlug)}` : '#'}"><div class="meta"><span class="tag">${escapeHtml(topic.status)}</span><span>${escapeHtml(topic.evidenceCount)} señales</span></div><h3>${escapeHtml(topic.label)}</h3></a>`).join('');
  const linkHtml = links.map((link) => `<div class="card"><div class="meta"><span class="tag">${escapeHtml(link.module)}</span></div><h3>${escapeHtml(link.label)}</h3><p>${escapeHtml(link.reason)}</p><div class="actions"><a class="btn" href="${escapeHtml(actionHref(link))}">${escapeHtml(link.label)}</a></div></div>`).join('');
  const voiceHtml = voices.map((item) => `<article class="card voice-card"><div class="type">${escapeHtml(item.voiceType || 'VOZ LOCAL')}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="by">${escapeHtml(item.contributorLabel || item.source?.label || '')}</div></article>`).join('');

  return `${gateNotice(payload, document.body.dataset.newsSource)}
    ${section('Ahora', current.length ? `<div class="brief-list">${current.map(brief).join('')}</div>` : '', 'Cambios con impacto cercano')}
    ${section('En el mapa', mapHtml, 'Solo ubicaciones verificadas')}
    ${section('Noticias breves', briefs.length ? `<div class="grid2">${briefs.map((x) => card(x)).join('')}</div>` : '', 'Sin relleno')}
    ${section('Temas que seguimos', topicHtml, 'Repetición no significa prueba')}
    ${section('Desde otros espacios de Palta', linkHtml ? `<div class="grid2">${linkHtml}</div>` : '')}
    ${section(`Voces de ${placeLabel(payload.geography)}`, voiceHtml, 'Experiencia separada de hechos noticiosos')}`;
}

function actionsHtml(actions = []) {
  if (!actions.length) return '';
  return `<div class="actions">${actions.map((action, index) => `<a class="btn ${index === 0 ? 'primary' : ''}" href="${escapeHtml(actionHref(action))}">${escapeHtml(action.label)}</a>`).join('')}</div>`;
}

function renderStory(story) {
  const body = (story.body || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const bodyHtml = body || `<p>${escapeHtml(story.summary)}</p>`;
  const mapHtml = story.mapContext?.status === 'verified'
    ? `<div class="mapbox"><span class="map-label">${escapeHtml(story.mapContext.label)}</span></div>`
    : '';
  const why = story.whyItMatters ? `<div class="contextbox"><h3>Por qué importa</h3><p>${escapeHtml(story.whyItMatters)}</p></div>` : '';
  const known = story.knownUnknown?.known || [];
  const unknown = story.knownUnknown?.unknown || [];
  const knownUnknown = known.length || unknown.length
    ? `<div class="known"><div class="contextbox"><h3>Sabemos</h3>${known.map((x) => `<p>${escapeHtml(x)}</p>`).join('')}</div><div class="contextbox"><h3>No sabemos</h3>${unknown.map((x) => `<p>${escapeHtml(x)}</p>`).join('')}</div></div>`
    : '';
  const sourceLink = story.source?.url ? `<div class="actions"><a class="btn" rel="noopener noreferrer" href="${escapeHtml(story.source.url)}">Ir a la fuente original</a></div>` : '';
  const voiceDisclosure = story.contentClass === 'local_voice'
    ? `<div class="contextbox"><h3>Voz local</h3><p>${escapeHtml(story.perspectiveDisclosure || story.source?.attribution || '')}</p><p class="by">${escapeHtml(story.contributorLabel || story.source?.label || '')} · ${escapeHtml(story.voiceType || '')}</p></div>`
    : '';

  document.title = `${story.title} — Noticias`;
  return `<article class="article">
    ${gateNotice(story, document.body.dataset.newsSource)}
    <div class="article-label">${escapeHtml(story.contentClass)} · ${escapeHtml(placeLabel(story.geography))}</div>
    <h1>${escapeHtml(story.title)}</h1>
    <p class="standfirst">${escapeHtml(story.standfirst || story.summary)}</p>
    <div class="article-meta"><span>${escapeHtml(placeLabel(story.geography))}</span><span>${escapeHtml(formatDate(story.publishedAt))}</span>${story.updatedAt ? `<span>Actualizado ${escapeHtml(formatDate(story.updatedAt))}</span>` : ''}</div>
    ${voiceDisclosure}
    <div class="body">${bodyHtml}</div>
    ${mapHtml}
    ${actionsHtml(story.actions)}
    ${why}
    ${knownUnknown}
    <div class="sourcebox"><h3>Fuente</h3><p><strong>${escapeHtml(story.source?.label || 'Fuente')}</strong></p><p>${escapeHtml(story.source?.attribution || '')}</p>${sourceLink}</div>
    ${story.updatedNotice ? `<div class="sourcebox"><h3>Actualizaciones y correcciones</h3><p>${escapeHtml(story.updatedNotice)}</p></div>` : ''}
  </article>`;
}

function renderDeepDive(story) {
  const body = story.body || [];
  const known = story.knownUnknown?.known || [];
  const unknown = story.knownUnknown?.unknown || [];
  const timeline = story.timeline || [];
  document.title = `${story.title} — En profundidad`;
  return `<article class="article">
    ${gateNotice(story, document.body.dataset.newsSource)}
    <div class="article-label">En profundidad · ${escapeHtml(placeLabel(story.geography))}</div>
    <h1>${escapeHtml(story.title)}</h1>
    <p class="standfirst">${escapeHtml(story.standfirst || story.summary)}</p>
    ${section('Qué sabemos y qué no sabemos', `<div class="known"><div class="contextbox"><h3>Sabemos</h3>${known.map((x) => `<p>${escapeHtml(x)}</p>`).join('') || '<p>Sin afirmaciones adicionales publicadas.</p>'}</div><div class="contextbox"><h3>No sabemos</h3>${unknown.map((x) => `<p>${escapeHtml(x)}</p>`).join('') || '<p>Sin preguntas abiertas publicadas.</p>'}</div></div>`)}
    ${body.map((paragraph, index) => `<div class="deep-block"><h2>${index + 1}. Contexto</h2><div class="body"><p>${escapeHtml(paragraph)}</p></div></div>`).join('')}
    ${story.whyItMatters ? `<div class="deep-block"><h2>Qué cambia para la vida diaria</h2><div class="body"><p>${escapeHtml(story.whyItMatters)}</p></div>${actionsHtml(story.actions)}</div>` : actionsHtml(story.actions)}
    ${timeline.length ? `<div class="sourcebox"><h3>Seguimiento</h3>${timeline.map((x) => `<p>${escapeHtml(formatDate(x.at))} · ${escapeHtml(x.label)}</p>`).join('')}</div>` : ''}
    <div class="sourcebox"><h3>Fuente y atribución</h3><p>${escapeHtml(story.source?.attribution || '')}</p></div>
  </article>`;
}

function voiceGroup(title, rows, note) {
  if (!rows.length) return '';
  return section(title, `<div class="grid2">${rows.map((item) => `<article class="card voice-card"><div class="type">${escapeHtml(item.voiceType)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="by">${escapeHtml(item.contributorLabel)} · derechos: ${escapeHtml(item.mediaRights)}</div></article>`).join('')}</div>`, note);
}

function renderVoices(payload) {
  const groups = {
    interview: [], essay: [], field_note: [], photo_essay: [], student_art: [], local_memory: [], proposal: [],
  };
  for (const item of payload.contributions || []) {
    if (groups[item.voiceType]) groups[item.voiceType].push(item);
  }
  const showcase = [...groups.photo_essay, ...groups.student_art];
  return `${gateNotice(payload, document.body.dataset.newsSource)}
    <div class="notice">${escapeHtml(payload.disclosure || '')}</div>
    ${voiceGroup('Personas que hacen funcionar el barrio', groups.interview, 'Entrevistas')}
    ${voiceGroup('Ensayos y observaciones', [...groups.essay, ...groups.field_note, ...groups.local_memory, ...groups.proposal], 'Opinión y experiencia claramente etiquetadas')}
    ${voiceGroup('Muestra comunitaria', showcase, 'Solo contenido con estado de derechos explícito')}`;
}

function renderError(error) {
  const root = document.getElementById('news-root');
  if (!root) return;
  root.innerHTML = `<div class="notice"><strong>News no está disponible en esta vista.</strong><br>${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
}

async function main() {
  const root = document.getElementById('news-root');
  if (!root) return;
  try {
    const payload = await loadPayload();
    const view = document.body.dataset.newsView;
    if (view === 'home') root.innerHTML = renderHome(payload);
    else if (view === 'local') root.innerHTML = renderLocal(payload);
    else if (view === 'story') root.innerHTML = renderStory(payload);
    else if (view === 'deep-dive') root.innerHTML = renderDeepDive(payload);
    else if (view === 'voices') root.innerHTML = renderVoices(payload);
    else throw new Error('Vista News desconocida.');
  } catch (error) {
    renderError(error);
  }
}

main();
