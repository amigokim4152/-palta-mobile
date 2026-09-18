const base = process.argv[2];

if (!base) {
  console.error('Usage: node verify-map-range.mjs https://host.example');
  process.exit(2);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = base.replace(/\/$/, '');
const manifestUrl = `${origin}/maps/cl/manifest.json`;
const styleUrl = `${origin}/maps/cl/style.json`;
const mapUrl = `${origin}/maps/cl/basemap.pmtiles`;

const manifestResponse = await fetch(manifestUrl);
assert(
  manifestResponse.status === 200,
  `Manifest expected 200, got ${manifestResponse.status}`,
);
const manifest = await manifestResponse.json();
assert(manifest.country === 'CL', 'Manifest country must be CL');
assert(typeof manifest.version === 'string', 'Manifest version missing');
assert(manifest.pmtiles_url === mapUrl, 'Manifest PMTiles URL mismatch');
assert(manifest.style_url === styleUrl, 'Manifest style URL mismatch');

const styleResponse = await fetch(styleUrl);
assert(styleResponse.status === 200, `Style expected 200, got ${styleResponse.status}`);
const style = await styleResponse.json();
assert(style.version === 8, 'MapLibre style version must be 8');
assert(style.sources?.chile?.type === 'vector', 'Chile vector source missing');
assert(
  style.sources?.chile?.url === `pmtiles://${mapUrl}`,
  'Style PMTiles source mismatch',
);

const head = await fetch(mapUrl, { method: 'HEAD' });
assert(head.status === 200, `HEAD expected 200, got ${head.status}`);
const fullSize = Number(head.headers.get('content-length'));
assert(Number.isFinite(fullSize) && fullSize > 0, 'HEAD missing full Content-Length');
assert(
  head.headers.get('accept-ranges')?.toLowerCase() === 'bytes',
  'HEAD missing Accept-Ranges: bytes',
);

const range = await fetch(mapUrl, {
  headers: { Range: 'bytes=0-15' },
});
assert(range.status === 206, `Range expected 206, got ${range.status}`);
assert(
  range.headers.get('content-range') === `bytes 0-15/${fullSize}`,
  `Unexpected Content-Range: ${range.headers.get('content-range')}`,
);
const body = new Uint8Array(await range.arrayBuffer());
assert(body.byteLength === 16, `Expected 16 bytes, got ${body.byteLength}`);

const magic = new TextDecoder().decode(body.slice(0, 7));
assert(magic === 'PMTiles', `Unexpected PMTiles magic: ${JSON.stringify(magic)}`);

const suffix = await fetch(mapUrl, {
  headers: { Range: 'bytes=-16' },
});
assert(suffix.status === 206, `Suffix expected 206, got ${suffix.status}`);
const suffixBody = new Uint8Array(await suffix.arrayBuffer());
assert(suffixBody.byteLength === 16, 'Suffix range did not return 16 bytes');

const immutableResponse = await fetch(manifest.immutable_version_url, {
  headers: { Range: 'bytes=0-15' },
});
assert(
  immutableResponse.status === 206,
  `Immutable version range expected 206, got ${immutableResponse.status}`,
);

console.log('PASS: Palta Chile PMTiles production verification');
console.log(
  JSON.stringify(
    {
      version: manifest.version,
      manifestUrl,
      styleUrl,
      mapUrl,
      immutableUrl: manifest.immutable_version_url,
      fullSize,
      firstRange: range.headers.get('content-range'),
      suffixRange: suffix.headers.get('content-range'),
    },
    null,
    2,
  ),
);
