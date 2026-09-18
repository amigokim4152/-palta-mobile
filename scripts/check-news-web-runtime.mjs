import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const webRoot = path.join(root, 'news-web');
const htmlFiles = ['index.html', 'comuna.html', 'story.html', 'deep-dive.html', 'voices.html'];
const forbidden = new Set([
  'risk_flags', 'editorial_state', 'reviewer_notes', 'ai_notes', 'ai_processed',
  'raw_title', 'source_excerpt', 'fact_object', 'verification_queue',
]);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function assertNoForbidden(value, label) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (forbidden.has(key)) fail(`${label} contains internal News field ${key}`);
      stack.push(child);
    }
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(webRoot, file), 'utf8');
  if (!html.includes('data-news-source="auto"')) fail(`${file} must use deployment-safe auto source mode`);
  if (!html.includes('src="app.js"')) fail(`${file} must use app.js`);
  if (html.includes('runtime.js')) fail(`${file} still references retired runtime.js`);
  if (!html.includes('id="news-root"')) fail(`${file} must expose #news-root for contract-driven rendering`);
}

const app = read('news-web/app.js');
if (!app.includes("LOCAL_HOSTS.has(location.hostname) ? 'mock' : 'api'")) {
  fail('app.js must select mock only for local hosts and API elsewhere');
}
if (!app.includes("throw new Error('Los datos mock solo pueden usarse en localhost.')")) {
  fail('app.js must reject forced mock mode off localhost');
}
if (app.includes('editorial-inbox') || app.includes('editorial-reviewed') || app.includes('source-state.json')) {
  fail('app.js must not reference raw/editorial News storage');
}

const home = JSON.parse(read('news-web/mock/home.json'));
const story = JSON.parse(read('news-web/mock/story.json'));
const local = JSON.parse(read('news-web/mock/comuna-vitacura.json'));
const voices = JSON.parse(read('news-web/mock/voices.json'));
const deep = JSON.parse(read('news-web/mock/deep-dive.json'));
for (const [label, payload] of Object.entries({ home, story, local, voices, deep })) {
  assertNoForbidden(payload, `mock/${label}`);
}

if (home.publicationGate !== 'closed' || local.publicationGate !== 'closed' || voices.publicationGate !== 'closed') {
  fail('list-page development mocks must remain publicationGate=closed');
}
if (story.contentClass === 'external_summary' && Object.hasOwn(story, 'body')) {
  fail('external-summary mock must not contain article body');
}
if (deep.contentClass !== 'deep_dive' || !Array.isArray(deep.body) || deep.body.length === 0) {
  fail('Deep Dive mock must be an owned/structured detail fixture with body content');
}
for (const [index, contribution] of voices.contributions.entries()) {
  if (contribution.section !== 'voices' || contribution.contentClass !== 'local_voice') {
    fail(`voices contribution ${index} must be section=voices and contentClass=local_voice`);
  }
  for (const field of ['voiceType', 'contributorLabel', 'perspectiveDisclosure', 'mediaRights']) {
    if (!contribution[field]) fail(`voices contribution ${index} is missing ${field}`);
  }
}

if (!process.exitCode) console.log('PASS: News Web runtime/fixture deployment-safety checks');
