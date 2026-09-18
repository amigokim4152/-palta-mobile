const base = process.argv[2];

if (!base) {
  console.error('Usage: node verify-map-range.mjs https://host.example');
  process.exit(2);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalizedBase = base.replace(/\/$/, '');
const styleUrl = `${normalizedBase}/maps/style.json`;
const pmtilesUrl = `${normalizedBase}/maps/santiago.pmtiles`;

const styleResponse = await fetch(styleUrl);
assert(styleResponse.status === 200, `Style expected 200, got ${styleResponse.status}`);
assert(
  styleResponse.headers.get('content-type')?.includes('application/json'),
  `Style expected JSON Content-Type, got ${styleResponse.headers.get('content-type')}`,
);
const style = await styleResponse.json();
assert(style.version === 8, `Style version expected 8, got ${style.version}`);
assert(style.sources?.santiago?.type === 'vector', 'Style is missing vector source santiago');
assert(
  style.sources?.santiago?.url === `pmtiles://${pmtilesUrl}`,
  `Unexpected PMTiles source URL: ${style.sources?.santiago?.url}`,
);
for (const layer of ['earth', 'landcover', 'landuse', 'water', 'boundaries', 'roads', 'buildings']) {
  assert(
    style.layers?.some((candidate) => candidate.id === layer),
    `Style is missing ${layer} layer`,
  );
}

const head = await fetch(pmtilesUrl, { method: 'HEAD' });
assert(head.status === 200, `HEAD expected 200, got ${head.status}`);
const fullSize = Number(head.headers.get('content-length'));
assert(Number.isFinite(fullSize) && fullSize > 0, 'HEAD missing full Content-Length');
assert(
  head.headers.get('accept-ranges')?.toLowerCase() === 'bytes',
  'HEAD missing Accept-Ranges: bytes',
);

const range = await fetch(pmtilesUrl, {
  headers: { Range: 'bytes=0-15' },
});
assert(range.status === 206, `Range expected 206, got ${range.status}`);
assert(
  range.headers.get('content-range') === `bytes 0-15/${fullSize}`,
  `Unexpected Content-Range: ${range.headers.get('content-range')}`,
);
const body = new Uint8Array(await range.arrayBuffer());
assert(body.byteLength === 16, `Expected 16 bytes, got ${body.byteLength}`);

const suffix = await fetch(pmtilesUrl, {
  headers: { Range: 'bytes=-16' },
});
assert(suffix.status === 206, `Suffix expected 206, got ${suffix.status}`);
const suffixBody = new Uint8Array(await suffix.arrayBuffer());
assert(suffixBody.byteLength === 16, 'Suffix range did not return 16 bytes');

console.log('PASS: Palta MapLibre style + PMTiles HTTP verification');
console.log(JSON.stringify({
  styleUrl,
  pmtilesUrl,
  styleLayers: style.layers.map((layer) => layer.id),
  fullSize,
  firstRange: range.headers.get('content-range'),
  suffixRange: suffix.headers.get('content-range'),
}, null, 2));
