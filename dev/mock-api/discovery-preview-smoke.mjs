const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8794';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function search(query) {
  const url = new URL('/v1/local/search', baseUrl);
  url.searchParams.set('lat', '-33.39');
  url.searchParams.set('lng', '-70.57');
  if (query) url.searchParams.set('q', query);

  const response = await fetch(url);
  assert(response.ok, `search failed: ${response.status}`);
  return response.json();
}

const taller = await search('taller');
assert(taller.items.length === 1, 'taller search should return one result');
assert(
  JSON.stringify(taller.items[0].service_labels) === JSON.stringify(['Mantención', 'Frenos']),
  'discovery search must project at most the first two useful service labels',
);
assert(
  taller.items[0].highlight === 'Agenda disponible esta semana',
  'recent useful post should fill the highlight when there is no active coupon',
);

const farmacia = await search('farmacia');
assert(farmacia.items.length === 1, 'farmacia search should return one result');
assert(
  JSON.stringify(farmacia.items[0].service_labels) === JSON.stringify(['Farmacia', 'Cuidado personal']),
  'pharmacy discovery result should project useful service labels',
);
assert(
  farmacia.items[0].highlight === '10% en cuidado personal',
  'active coupon must win the single discovery highlight slot',
);
assert(
  farmacia.items[0].highlight !== 'Negocio verificado',
  'verification is trust metadata and must never consume the useful highlight slot',
);

console.log('PASS: Local Business discovery preview HTTP projection');
