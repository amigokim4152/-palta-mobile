import { strict as assert } from 'node:assert';
import { buildLocalBusinessDiscoveryPreview } from '../src/business/localBusinessDiscoveryPreview.js';

const rich = buildLocalBusinessDiscoveryPreview({
  photoUrls: ['', 'ftp://unsafe.example/photo.jpg', 'https://cdn.example.com/business.jpg'],
  serviceLabels: [' Panadería ', 'Café', 'Desayuno', 'Café'],
  activeCouponTitle: ' 10% en café para llevar ',
  recentPostTitle: 'Pan amasado recién salido',
});

assert.equal(rich.photoUrl, 'https://cdn.example.com/business.jpg');
assert.deepEqual(rich.serviceLabels, ['Panadería', 'Café']);
assert.deepEqual(rich.highlight, {
  kind: 'coupon',
  label: '10% en café para llevar',
});

const postOnly = buildLocalBusinessDiscoveryPreview({
  serviceLabels: ['Gasfitería'],
  recentPostTitle: 'Agenda disponible esta semana',
});
assert.deepEqual(postOnly.highlight, {
  kind: 'post',
  label: 'Agenda disponible esta semana',
});

const empty = buildLocalBusinessDiscoveryPreview({
  photoUrls: ['javascript:alert(1)'],
  serviceLabels: [' ', ''],
});
assert.equal(empty.photoUrl, undefined);
assert.deepEqual(empty.serviceLabels, []);
assert.equal(empty.highlight, undefined);

console.log('PASS: Local Business bounded discovery preview');
