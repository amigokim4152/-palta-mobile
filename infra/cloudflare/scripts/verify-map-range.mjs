const base = process.argv[2];

if (!base) {
  console.error('Usage: node verify-map-range.mjs https://host.example');
  process.exit(2);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const url = `${base.replace(/\/$/, '')}/maps/santiago.pmtiles`;

const head = await fetch(url, { method: 'HEAD' });
assert(head.status === 200, `HEAD expected 200, got ${head.status}`);
const fullSize = Number(head.headers.get('content-length'));
assert(Number.isFinite(fullSize) && fullSize > 0, 'HEAD missing full Content-Length');
assert(
  head.headers.get('accept-ranges')?.toLowerCase() === 'bytes',
  'HEAD missing Accept-Ranges: bytes',
);

const range = await fetch(url, {
  headers: { Range: 'bytes=0-15' },
});
assert(range.status === 206, `Range expected 206, got ${range.status}`);
assert(
  range.headers.get('content-range') === `bytes 0-15/${fullSize}`,
  `Unexpected Content-Range: ${range.headers.get('content-range')}`,
);
const body = new Uint8Array(await range.arrayBuffer());
assert(body.byteLength === 16, `Expected 16 bytes, got ${body.byteLength}`);

const suffix = await fetch(url, {
  headers: { Range: 'bytes=-16' },
});
assert(suffix.status === 206, `Suffix expected 206, got ${suffix.status}`);
const suffixBody = new Uint8Array(await suffix.arrayBuffer());
assert(suffixBody.byteLength === 16, 'Suffix range did not return 16 bytes');

console.log('PASS: Palta PMTiles HTTP Range verification');
console.log(JSON.stringify({
  url,
  fullSize,
  firstRange: range.headers.get('content-range'),
  suffixRange: suffix.headers.get('content-range'),
}, null, 2));
