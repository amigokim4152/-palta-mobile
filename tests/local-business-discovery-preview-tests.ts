import {
  buildLocalBusinessDiscoveryPreview,
  localBusinessConsumerCategoryLabel,
  readLocalBusinessDiscoveryPreview,
} from '../src/business/localBusinessDiscoveryPreview.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sameJson(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const rich = buildLocalBusinessDiscoveryPreview({
  photoUrls: ['', 'ftp://unsafe.example/photo.jpg', 'https://cdn.example.com/business.jpg'],
  serviceLabels: [' Panadería ', 'Café', 'Desayuno', 'Café'],
  activeCouponTitle: ' 10% en café para llevar ',
  recentPostTitle: 'Pan amasado recién salido',
});

assert(rich.photoUrl === 'https://cdn.example.com/business.jpg', 'First safe public photo should be selected.');
sameJson(rich.serviceLabels, ['Panadería', 'Café'], 'Discovery must expose at most two normalized service labels.');
sameJson(
  rich.highlight,
  { kind: 'coupon', label: '10% en café para llevar' },
  'A current benefit should take priority over a general update.',
);

const postOnly = buildLocalBusinessDiscoveryPreview({
  serviceLabels: ['Gasfitería'],
  recentPostTitle: 'Agenda disponible esta semana',
});
sameJson(
  postOnly.highlight,
  { kind: 'post', label: 'Agenda disponible esta semana' },
  'A useful fresh post should be available when there is no active benefit.',
);

const empty = buildLocalBusinessDiscoveryPreview({
  photoUrls: ['javascript:alert(1)'],
  serviceLabels: [' ', ''],
});
assert(empty.photoUrl === undefined, 'Unsafe media schemes must not enter discovery preview.');
sameJson(empty.serviceLabels, [], 'Empty service labels must be removed.');
assert(empty.highlight === undefined, 'Preview must remain quiet when there is no useful current highlight.');

const canonicalWire = readLocalBusinessDiscoveryPreview({
  preview: {
    photoUrl: 'https://cdn.example.com/profile.jpg',
    serviceLabels: [' Corte ', 'Color', 'Peinado'],
    highlight: { kind: 'post', label: ' Cupos mañana ' },
  },
});
assert(
  canonicalWire.photoUrl === 'https://cdn.example.com/profile.jpg',
  'Canonical nested preview should preserve a safe public photo.',
);
sameJson(
  canonicalWire.serviceLabels,
  ['Corte', 'Color'],
  'Canonical nested preview should remain bounded to two service labels.',
);
sameJson(
  canonicalWire.highlight,
  { kind: 'post', label: 'Cupos mañana' },
  'Canonical nested preview should preserve the explicit highlight kind.',
);

const legacyWire = readLocalBusinessDiscoveryPreview({
  image_url: 'https://cdn.example.com/legacy.jpg',
  service_labels: ['Mecánica general', 'Frenos', 'Diagnóstico'],
  highlight: 'Diagnóstico con cupos esta semana',
});
assert(
  legacyWire.photoUrl === 'https://cdn.example.com/legacy.jpg',
  'Temporary flat search payload should normalize through the same Core boundary.',
);
sameJson(
  legacyWire.serviceLabels,
  ['Mecánica general', 'Frenos'],
  'Temporary flat service labels should remain bounded.',
);
sameJson(
  legacyWire.highlight,
  { kind: 'unknown', label: 'Diagnóstico con cupos esta semana' },
  'Legacy highlight without a kind must not be misclassified as coupon or post.',
);

const unsafeWire = readLocalBusinessDiscoveryPreview({
  image_url: 'https://user:password@example.com/private.jpg',
  service_labels: [' ', 17, 'Farmacia'],
  highlight: ' ',
});
assert(unsafeWire.photoUrl === undefined, 'Search preview must reject credential-bearing media URLs.');
sameJson(unsafeWire.serviceLabels, ['Farmacia'], 'Malformed service labels should be discarded.');
assert(unsafeWire.highlight === undefined, 'Blank wire highlight should remain quiet.');

assert(
  localBusinessConsumerCategoryLabel('auto_repair') === 'Taller mecánico',
  'Known taxonomy may project to explicit consumer copy.',
);
assert(
  localBusinessConsumerCategoryLabel('internal_future_key') === undefined,
  'Unknown internal taxonomy keys must never be rendered as consumer copy.',
);

console.log('PASS: Local Business bounded canonical discovery preview');
