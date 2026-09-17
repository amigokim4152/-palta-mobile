import { buildLocalBusinessDiscoveryPreview } from '../src/business/localBusinessDiscoveryPreview.js';

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

console.log('PASS: Local Business bounded discovery preview');
