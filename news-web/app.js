const FORBIDDEN_PUBLIC_FIELDS = new Set([
  'risk_flags', 'editorial_state', 'reviewer_notes', 'ai_notes', 'ai_processed',
  'raw_title', 'source_excerpt', 'fact_object', 'verification_queue',
]);
const PUBLIC_API_PREFIX = '/v1/cl/news/';
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function assertSafe(value) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) { stack.push(...current); continue; }
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_PUBLIC_FIELDS.has(key)) throw new Error(`Campo editorial interno bloqueado: ${key}`);
      stack.push(child);
    }
  }
}

function safeSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new Error('Ruta de noticia inválida.');
  return slug;
}

function activeSource() {
  const configured = document.body.dataset.newsSource || 'auto';
  if (configured === 'auto') return LOCAL_HOSTS.has(location.hostname) ? 'mock' : 'api';
  if (configured === 'mock' && !LOCAL_HOSTS.has(location.hostname)) {
    throw new Error('Los datos mock solo pueden usarse en localhost.');
  }
  if (configured === 'mock' || configured === 'api') return configured;
  throw new Error('Fuente de News no habilitada.');
}

function querySlug(defaultSlug = '') {
  const raw = new URLSearchParams(location.search).get('slug') || defaultSlug;
  return raw ? safeSlug(raw) : '';
}

function apiPath(view, slug) {
  if (view === 'home') return '/v1/cl/news/home';
  if (view === 'local') return `/v1/cl/news/comunas/${safeSlug(slug)}`;
  if (view === 'story' || view === 'deep-dive') return `/v1/cl/news/stories/${safeSlug(slug)}`;
  if (view === 'voices') return '/v1/cl/news/voices';
  throw new Error('Vista News desconocida.');
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' });
  if (!response.ok) {
    let reason = '';
    try {
      const payload = await response.json();
      reason = payload?.reason ? ` · ${payload.reason}` : '';
    } catch {}
    throw new Error(`No se pudo cargar News (${response.status}${reason}).`);
  }
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new Error('News devolvió una respuesta no JSON.');
  const payload = await response.json();
  assertSafe(payload);
  return payload;
}

async function loadMockStory(slug) {
  const direct = await fetchJson('mock/story.json');
  if (!slug || direct.slug === slug) return direct;
  const home = await fetchJson('mock/home.json');
  for (const rows of Object.values(home.sections || {})) {
    const found = Array.isArray(rows) ? rows.find((item) => item.slug === slug) : undefined;
    if (found) return found;
  }
  throw new Error('No existe un detalle ficticio para esta noticia.');
}

async function loadPayload(source) {
  const { newsView: view = '', newsMock: mockPath = '', newsSlug: defaultSlug = '' } = document.body.dataset;
  const slug = querySlug(defaultSlug);
  if (source === 'mock') {
    if (view === 'story') return loadMockStory(slug);
    if (!mockPath) throw new Error('Falta la ruta mock explícita.');
    return fetchJson(mockPath);
  }
  const path = apiPath(view, slug);
  if (!path.startsWith(PUBLIC_API_PREFIX)) throw new Error('Ruta pública de News inválida.');
  return fetchJson(path);
}

function dateLabel(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function place(geo = {}) { return geo.localityName || geo.comunaName || geo.regionName || 'Chile'; }
function hrefForStory(item) {
  if (!item?.slug) return '#';
  if (item.contentClass === 'deep_dive') return `deep-dive.html?slug=${encodeURIComponent(item.slug)}`;
  if (item.contentClass === 'local_voice') return 'voices.html';
  return `story.html?slug=${encodeURIComponent(item.slug)}`;
}
function hrefForAction(action) {
  const target = String(action?.target || '');
  return target.startsWith('/') || target.startsWith('https://') || target.startsWith('palta://') ? target : '#';
}
function section(title, content, note = '') {
  if (!content) return '';
  return `<section class="section"><div class="section-head"><h2>${esc(title)}</h2>${note ? `<span class="section-note">${esc(note)}</span>` : ''}</div>${content}</section>`;
}
function notice(payload, source) {
  if (source === 'mock') return '<div class="notice">Datos ficticios de desarrollo · modo mock local · sin publicación real.</div>';
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'publicationGate') && payload.publicationGate !== 'open') {
    return '<div class="notice">La proyección pública de News no está habilitada.</div>';
  }
  return '';
}
function card(item, className = '') {
  return `<a class="card ${className}" href="${esc(hrefForStory(item))}">
    <div class="meta"><span class="tag">${esc(item.topic || item.contentClass)}</span><span>${esc(place(item.geography))} · ${esc(dateLabel(item.publishedAt))}</span></div>
    <h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></a>`;
}
function brief(item) {
  return `<a class="brief" href="${esc(hrefForStory(item))}"><div class="brief-time">${esc(dateLabel(item.publishedAt))}</div><div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></div></a>`;
}
function actions(rows = []) {
  if (!rows.length) return '';
  return `<div class="actions">${rows.map((row, i) => `<a class="btn ${i === 0 ? 'primary' : ''}" href="${esc(hrefForAction(row))}">${esc(row.label)}</a>`).join('')}</div>`;
}

function renderHome(payload, source) {
  const sorted = (key, limit) => [...(payload.sections?.[key] || [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, limit);
  const essential = sorted('essential', 3);
  const nearby = sorted('nearby', 12);
  const local = sorted('local', 12);
  const chile = sorted('chile', 8);
  const deep = sorted('deep_dive', 4);
  const voices = sorted('voices', 4);
  const lead = essential.length ? `<div class="lead">${card(essential[0], 'hero')}<div class="stack">${essential.slice(1).map((x) => card(x)).join('')}</div></div>` : '';
  return `${notice(payload, source)}
    ${section('Lo esencial', lead, 'Pocas cosas, bien escogidas')}
    ${section('Cerca de ti', nearby.length ? `<div class="brief-list">${nearby.map(brief).join('')}</div>` : '', 'Cambios con impacto cercano')}
    ${section('En tu comuna', local.length ? `<div class="grid2">${local.map((x) => card(x)).join('')}</div>` : '', 'Cambios y temas locales')}
    ${section('Chile', chile.length ? `<div class="grid2">${chile.map((x) => card(x)).join('')}</div>` : '', 'Solo cuando importa para tu vida')}
    ${section('En profundidad', deep.map((x) => card(x)).join(''), 'Contexto y seguimiento')}
    ${section('Voces locales', voices.length ? `<div class="grid2">${voices.map((x) => card(x, 'voice-card')).join('')}</div>` : '', 'Perspectivas claramente etiquetadas')}`;
}

function renderLocal(payload, source) {
  const current = payload.current || [], briefs = payload.briefs || [], voices = payload.voices || [];
  const mapped = [...current, ...briefs].filter((item) => item.mapContext?.status === 'verified');
  const mastTitle = document.querySelector('[data-news-mast-title]');
  const mastPlace = document.querySelector('[data-news-mast-place]');
  if (mastTitle) mastTitle.textContent = place(payload.geography);
  if (mastPlace) mastPlace.textContent = payload.heading || 'Noticias y cambios locales';
  document.title = `${place(payload.geography)} — Noticias`;
  const mapHtml = mapped.length ? `<div class="mapbox"><span class="map-label">${esc(mapped[0].mapContext.label)}</span></div>` : '<div class="card"><p>No hay ubicaciones verificadas para mostrar.</p></div>';
  const topics = (payload.trackedTopics || []).map((topic) => `<a class="card" href="${topic.deepDiveSlug ? `deep-dive.html?slug=${encodeURIComponent(topic.deepDiveSlug)}` : '#'}"><div class="meta"><span class="tag">${esc(topic.status)}</span><span>${esc(topic.evidenceCount)} señales</span></div><h3>${esc(topic.label)}</h3></a>`).join('');
  const links = (payload.crossModuleLinks || []).map((link) => `<div class="card"><div class="meta"><span class="tag">${esc(link.module)}</span></div><h3>${esc(link.label)}</h3><p>${esc(link.reason)}</p><div class="actions"><a class="btn" href="${esc(hrefForAction(link))}">${esc(link.label)}</a></div></div>`).join('');
  const voiceCards = voices.map((item) => `<article class="card voice-card"><div class="type">${esc(item.voiceType)}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><div class="by">${esc(item.contributorLabel)}</div></article>`).join('');
  return `${notice(payload, source)}
    ${section('Ahora', current.length ? `<div class="brief-list">${current.map(brief).join('')}</div>` : '', 'Cambios con impacto cercano')}
    ${section('En el mapa', mapHtml, 'Solo ubicaciones verificadas')}
    ${section('Noticias breves', briefs.length ? `<div class="grid2">${briefs.map((x) => card(x)).join('')}</div>` : '', 'Sin relleno')}
    ${section('Temas que seguimos', topics, 'Repetición no significa prueba')}
    ${section('Desde otros espacios de Palta', links ? `<div class="grid2">${links}</div>` : '')}
    ${section(`Voces de ${place(payload.geography)}`, voiceCards, 'Experiencia separada de hechos noticiosos')}`;
}

function renderStory(story, source) {
  document.title = `${story.title} — Noticias`;
  const paragraphs = (story.body || []).map((p) => `<p>${esc(p)}</p>`).join('') || `<p>${esc(story.summary)}</p>`;
  const map = story.mapContext?.status === 'verified' ? `<div class="mapbox"><span class="map-label">${esc(story.mapContext.label)}</span></div>` : '';
  const known = story.knownUnknown?.known || [], unknown = story.knownUnknown?.unknown || [];
  const knownUnknown = known.length || unknown.length ? `<div class="known"><div class="contextbox"><h3>Sabemos</h3>${known.map((x) => `<p>${esc(x)}</p>`).join('')}</div><div class="contextbox"><h3>No sabemos</h3>${unknown.map((x) => `<p>${esc(x)}</p>`).join('')}</div></div>` : '';
  const voice = story.contentClass === 'local_voice' ? `<div class="contextbox"><h3>Voz local</h3><p>${esc(story.perspectiveDisclosure || story.source?.attribution)}</p><div class="by">${esc(story.contributorLabel || story.source?.label)} · ${esc(story.voiceType)} · derechos ${esc(story.mediaRights)}</div></div>` : '';
  const sourceLink = story.source?.url ? `<div class="actions"><a class="btn" rel="noopener noreferrer" href="${esc(story.source.url)}">Ir a la fuente original</a></div>` : '';
  return `<article class="article">${notice(story, source)}<div class="article-label">${esc(story.contentClass)} · ${esc(place(story.geography))}</div><h1>${esc(story.title)}</h1><p class="standfirst">${esc(story.standfirst || story.summary)}</p><div class="article-meta"><span>${esc(place(story.geography))}</span><span>${esc(dateLabel(story.publishedAt))}</span>${story.updatedAt ? `<span>Actualizado ${esc(dateLabel(story.updatedAt))}</span>` : ''}</div>${voice}<div class="body">${paragraphs}</div>${map}${actions(story.actions)}${story.whyItMatters ? `<div class="contextbox"><h3>Por qué importa</h3><p>${esc(story.whyItMatters)}</p></div>` : ''}${knownUnknown}<div class="sourcebox"><h3>Fuente</h3><p><strong>${esc(story.source?.label || 'Fuente')}</strong></p><p>${esc(story.source?.attribution || '')}</p>${sourceLink}</div>${story.updatedNotice ? `<div class="sourcebox"><h3>Actualizaciones y correcciones</h3><p>${esc(story.updatedNotice)}</p></div>` : ''}</article>`;
}

function renderDeepDive(story, source) {
  document.title = `${story.title} — En profundidad`;
  const known = story.knownUnknown?.known || [], unknown = story.knownUnknown?.unknown || [];
  const evidence = `<div class="known"><div class="contextbox"><h3>Sabemos</h3>${known.map((x) => `<p>${esc(x)}</p>`).join('') || '<p>Sin afirmaciones adicionales publicadas.</p>'}</div><div class="contextbox"><h3>No sabemos</h3>${unknown.map((x) => `<p>${esc(x)}</p>`).join('') || '<p>Sin preguntas abiertas publicadas.</p>'}</div></div>`;
  const body = (story.body || []).map((p, i) => `<div class="deep-block"><h2>${i + 1}. Contexto</h2><div class="body"><p>${esc(p)}</p></div></div>`).join('');
  const timeline = (story.timeline || []).map((x) => `<p>${esc(dateLabel(x.at))} · ${esc(x.label)}</p>`).join('');
  return `<article class="article">${notice(story, source)}<div class="article-label">En profundidad · ${esc(place(story.geography))}</div><h1>${esc(story.title)}</h1><p class="standfirst">${esc(story.standfirst || story.summary)}</p>${section('Qué sabemos y qué no sabemos', evidence)}${body}${story.whyItMatters ? `<div class="deep-block"><h2>Qué cambia para la vida diaria</h2><div class="body"><p>${esc(story.whyItMatters)}</p></div>${actions(story.actions)}</div>` : actions(story.actions)}${timeline ? `<div class="sourcebox"><h3>Seguimiento</h3>${timeline}</div>` : ''}<div class="sourcebox"><h3>Fuente y atribución</h3><p>${esc(story.source?.attribution || '')}</p></div></article>`;
}

function voiceGroup(title, rows, note) {
  if (!rows.length) return '';
  const cards = rows.map((item) => `<article class="card voice-card"><div class="type">${esc(item.voiceType)}</div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p><div class="by">${esc(item.contributorLabel)} · derechos ${esc(item.mediaRights)}</div></article>`).join('');
  return section(title, `<div class="grid2">${cards}</div>`, note);
}

function renderVoices(payload, source) {
  const groups = { interview: [], essay: [], field_note: [], photo_essay: [], student_art: [], local_memory: [], proposal: [] };
  for (const item of payload.contributions || []) if (groups[item.voiceType]) groups[item.voiceType].push(item);
  return `${notice(payload, source)}<div class="notice">${esc(payload.disclosure || '')}</div>${voiceGroup('Personas que hacen funcionar el barrio', groups.interview, 'Entrevistas')}${voiceGroup('Ensayos y observaciones', [...groups.essay, ...groups.field_note, ...groups.local_memory, ...groups.proposal], 'Opinión y experiencia claramente etiquetadas')}${voiceGroup('Muestra comunitaria', [...groups.photo_essay, ...groups.student_art], 'Solo contenido con derechos explícitos')}`;
}

function showError(error) {
  const root = document.getElementById('news-root');
  if (root) root.innerHTML = `<div class="notice"><strong>News no está disponible en esta vista.</strong><br>${esc(error instanceof Error ? error.message : String(error))}</div>`;
}

async function main() {
  const root = document.getElementById('news-root');
  if (!root) return;
  try {
    const source = activeSource();
    const payload = await loadPayload(source);
    const view = document.body.dataset.newsView;
    if (view === 'home') root.innerHTML = renderHome(payload, source);
    else if (view === 'local') root.innerHTML = renderLocal(payload, source);
    else if (view === 'story') root.innerHTML = renderStory(payload, source);
    else if (view === 'deep-dive') root.innerHTML = renderDeepDive(payload, source);
    else if (view === 'voices') root.innerHTML = renderVoices(payload, source);
    else throw new Error('Vista News desconocida.');
  } catch (error) { showError(error); }
}

main();
