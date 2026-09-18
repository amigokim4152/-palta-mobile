const base = process.argv[2];
const expectedStyleVersion =
  process.env.PALTA_EXPECTED_MAP_STYLE_VERSION ?? 'palta-v1.7';

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
const metadataUrl = `${origin}/maps/cl/metadata.json`;
const mapUrl = `${origin}/maps/cl/basemap.pmtiles`;
const fontUrl = `${origin}/maps/cl/fonts/NotoSans.ttf`;
const symbolFontUrl = `${origin}/maps/cl/fonts/NotoSansSymbols2.ttf`;
const fontLicenseUrl = `${origin}/maps/cl/fonts/OFL.txt`;

const manifestResponse = await fetch(manifestUrl);
assert(
  manifestResponse.status === 200,
  `Manifest expected 200, got ${manifestResponse.status}`,
);
const manifest = await manifestResponse.json();
assert(manifest.country === 'CL', 'Manifest country must be CL');
assert(typeof manifest.version === 'string', 'Manifest version missing');
assert(
  manifest.style_version === expectedStyleVersion,
  `Unexpected map style version: ${manifest.style_version}`,
);
assert(manifest.pmtiles_url === mapUrl, 'Manifest PMTiles URL mismatch');
assert(manifest.style_url === styleUrl, 'Manifest style URL mismatch');
assert(manifest.metadata_url === metadataUrl, 'Manifest metadata URL mismatch');
assert(manifest.font_url === fontUrl, 'Manifest font URL mismatch');
assert(
  manifest.symbol_font_url === symbolFontUrl,
  'Manifest symbol font URL mismatch',
);
assert(
  manifest.font_license_url === fontLicenseUrl,
  'Manifest font license URL mismatch',
);

const styleResponse = await fetch(styleUrl);
assert(styleResponse.status === 200, `Style expected 200, got ${styleResponse.status}`);
const style = await styleResponse.json();
assert(style.version === 8, 'MapLibre style version must be 8');
assert(
  style.metadata?.['palta:style-version'] === expectedStyleVersion,
  'Style metadata version mismatch',
);
assert(style.sources?.chile?.type === 'vector', 'Chile vector source missing');
assert(
  style.sources?.chile?.url === `pmtiles://${mapUrl}`,
  'Style PMTiles source mismatch',
);
assert(
  style.sources?.chile?.attribution?.includes('OpenStreetMap'),
  'OpenStreetMap attribution must remain available',
);
assert(
  style['font-faces']?.['Noto Sans']?.[0]?.url === fontUrl,
  'Self-hosted Noto Sans font-face missing',
);
assert(
  style['font-faces']?.['Noto Sans Symbols 2']?.[0]?.url === symbolFontUrl,
  'Self-hosted Noto Sans Symbols 2 font-face missing',
);

const layers = style.layers ?? [];
const layerIds = new Set(layers.map((layer) => layer?.id));
for (const id of [
  'place-labels',
  'road-labels-highway',
  'road-labels',
  'road-labels-local',
  'water-labels',
  'poi-labels',
  'roads-highway-casing',
  'roads-highway-fill',
  'roads-primary-casing',
  'roads-primary-fill',
  'roads-secondary-casing',
  'roads-secondary-fill',
  'roads-tertiary-fill',
]) {
  assert(layerIds.has(id), `Style hierarchy layer missing: ${id}`);
}
assert(!layerIds.has('roads-major'), 'Legacy flat roads-major layer must be removed');

const hierarchyChecks = [
  ['roads-highway-fill', ['motorway', 'trunk']],
  ['roads-primary-fill', ['primary']],
  ['roads-secondary-fill', ['secondary']],
  ['roads-tertiary-fill', ['tertiary']],
];
for (const [id, values] of hierarchyChecks) {
  const layer = layers.find((item) => item?.id === id);
  const filter = JSON.stringify(layer?.filter ?? null);
  assert(filter.includes('kind_detail'), `${id} must use kind_detail`);
  for (const value of values) {
    assert(filter.includes(value), `${id} missing ${value}`);
  }
}

const highwayLabels = layers.find((layer) => layer?.id === 'road-labels-highway');
const highwayFilter = JSON.stringify(highwayLabels?.filter ?? null);
for (const value of ['motorway', 'trunk']) {
  assert(highwayFilter.includes(value), `Highway labels missing ${value}`);
}
assert(
  highwayLabels?.layout?.['symbol-placement'] === 'line',
  'Highway names must follow road geometry',
);
assert(
  highwayLabels?.layout?.['text-rotation-alignment'] === 'map',
  'Highway labels must rotate with the road',
);
assert(
  Number(highwayLabels?.layout?.['symbol-spacing']) >= 1000,
  'Highway names repeat too frequently',
);

const roadLabels = layers.find((layer) => layer?.id === 'road-labels');
const roadLabelFilter = JSON.stringify(roadLabels?.filter ?? null);
for (const value of ['primary', 'secondary']) {
  assert(roadLabelFilter.includes(value), `Arterial labels missing ${value}`);
}
assert(
  !roadLabelFilter.includes('tertiary'),
  'Tertiary roads must not appear in arterial labels',
);
assert(
  roadLabels?.layout?.['symbol-placement'] === 'line',
  'Arterial road names must follow road geometry',
);
assert(
  Number(roadLabels?.layout?.['symbol-spacing']) >= 850,
  'Arterial road names repeat too frequently',
);
assert(
  Number(roadLabels?.minzoom) >= 11.5,
  `Arterial road labels are too dense: ${roadLabels?.minzoom}`,
);

const localRoadLabels = layers.find((layer) => layer?.id === 'road-labels-local');
const localRoadFilter = JSON.stringify(localRoadLabels?.filter ?? null);
for (const value of ['tertiary', 'residential', 'service']) {
  assert(localRoadFilter.includes(value), `Local road labels missing ${value}`);
}
assert(
  localRoadLabels?.layout?.['symbol-placement'] === 'line',
  'Local road names must follow road geometry',
);
assert(
  Number(localRoadLabels?.minzoom) >= 15.6,
  `Local road labels must wait until close zoom: ${localRoadLabels?.minzoom}`,
);
assert(
  Number(localRoadLabels?.layout?.['symbol-spacing']) >= 1200,
  'Local road names repeat too frequently',
);

const placeLabels = layers.find((layer) => layer?.id === 'place-labels');
assert(
  placeLabels?.layout?.['symbol-sort-key'] !== undefined,
  'Place labels must preserve locality priority',
);

const poiLabels = layers.find((layer) => layer?.id === 'poi-labels');
const poiFilter = JSON.stringify(poiLabels?.filter ?? null);
assert(poiFilter.includes('hospital'), 'Context POI labels must include hospitals');
assert(poiFilter.includes('school'), 'Context POI labels must include schools');
assert(
  !poiFilter.includes('restaurant') && !poiFilter.includes('cafe'),
  'Basemap POI labels must not compete with Palta business discovery',
);
assert(
  Number(poiLabels?.minzoom) >= 15.2,
  `POI labels must wait until close zoom: ${poiLabels?.minzoom}`,
);

const fontHead = await fetch(fontUrl, { method: 'HEAD' });
assert(fontHead.status === 200, `Font HEAD expected 200, got ${fontHead.status}`);
const fontSize = Number(fontHead.headers.get('content-length'));
assert(fontSize === 2049096, `Unexpected Noto Sans size: ${fontSize}`);
const fontContentType = fontHead.headers.get('content-type') ?? '';
assert(
  /font\/ttf|application\/x-font-ttf|application\/octet-stream/i.test(fontContentType),
  `Unexpected Noto Sans Content-Type: ${fontContentType}`,
);

const symbolFontHead = await fetch(symbolFontUrl, { method: 'HEAD' });
assert(
  symbolFontHead.status === 200,
  `Symbol font HEAD expected 200, got ${symbolFontHead.status}`,
);
const symbolFontSize = Number(symbolFontHead.headers.get('content-length'));
assert(
  Number.isFinite(symbolFontSize) && symbolFontSize > 100000,
  `Unexpected Noto Sans Symbols 2 size: ${symbolFontSize}`,
);

const licenseHead = await fetch(fontLicenseUrl, { method: 'HEAD' });
assert(
  licenseHead.status === 200,
  `Font license HEAD expected 200, got ${licenseHead.status}`,
);

const metadataResponse = await fetch(metadataUrl);
assert(
  metadataResponse.status === 200,
  `Metadata expected 200, got ${metadataResponse.status}`,
);
const metadata = await metadataResponse.json();
assert(metadata.country === 'CL', 'Metadata country must be CL');
assert(metadata.pmtiles_version === 3, 'PMTiles version must be 3');
assert(Array.isArray(metadata.bounds), 'PMTiles bounds missing');
assert(Array.isArray(metadata.center), 'PMTiles center missing');

const vectorLayerDefinitions = Array.isArray(metadata.metadata?.vector_layers)
  ? metadata.metadata.vector_layers
  : [];
const vectorLayers = vectorLayerDefinitions.map((layer) => layer?.id).filter(Boolean);
for (const id of ['places', 'roads', 'water', 'pois']) {
  assert(vectorLayers.includes(id), `PMTiles label source layer missing: ${id}`);
}
for (const id of ['places', 'roads', 'water', 'pois']) {
  const definition = vectorLayerDefinitions.find((layer) => layer?.id === id);
  assert(definition?.fields?.name === 'String', `${id} must expose name`);
  assert(definition?.fields?.['name:es'] === 'String', `${id} must expose name:es`);
}

const roadsDefinition = vectorLayerDefinitions.find((layer) => layer?.id === 'roads');
assert(
  roadsDefinition?.fields?.kind_detail === 'String',
  'roads must expose kind_detail for visual hierarchy',
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
      styleVersion: manifest.style_version,
      manifestUrl,
      styleUrl,
      metadataUrl,
      fontUrl,
      fontSize,
      symbolFontUrl,
      symbolFontSize,
      mapUrl,
      immutableUrl: manifest.immutable_version_url,
      fullSize,
      minZoom: metadata.min_zoom,
      maxZoom: metadata.max_zoom,
      bounds: metadata.bounds,
      center: metadata.center,
      vectorLayers,
      roadHierarchyLayers: [
        'roads-highway-casing',
        'roads-highway-fill',
        'roads-primary-casing',
        'roads-primary-fill',
        'roads-secondary-casing',
        'roads-secondary-fill',
        'roads-tertiary-fill',
      ],
      labelLayers: [
        'place-labels',
        'road-labels-highway',
        'road-labels',
        'road-labels-local',
        'water-labels',
        'poi-labels',
      ],
      firstRange: range.headers.get('content-range'),
      suffixRange: suffix.headers.get('content-range'),
    },
    null,
    2,
  ),
);
