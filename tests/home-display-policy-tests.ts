import { homeDisplayMode, prepareHomeDisplay } from '../src/home/homeDisplayPolicy.js';
import type { HomeApiItem, HomeApiResponse } from '../src/api/homeApiContract.js';

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const fixture: HomeApiItem = {
  id: 'demo-weather', capability_key: 'today.weather', kind: 'content', title: 'Weather',
  source_domain: 'weather', delivery: 'home', data_mode: 'demo', surface: 'useful_today',
};
const real: HomeApiItem = {
  id: 'real-weather', capability_key: 'today.weather', kind: 'content', title: 'Actual weather',
  source_domain: 'weather', delivery: 'home', data_mode: 'live', surface: 'useful_today',
};
const partial: HomeApiResponse = { items: [real], glance: [] };

assert(homeDisplayMode('development') === 'development_demo', 'Development must explicitly enable demo coverage.');
assert(homeDisplayMode('production') === 'personalized', 'Production must use personalized Home.');
assert(homeDisplayMode('preview') === 'development_demo', 'Preview must show complete demo coverage.');

const development = prepareHomeDisplay(partial, 'development', [fixture]);
assert(development.demo_mode === true, 'Development demo status must not depend on API flags.');
assert(development.items.length === 1 && development.items[0]?.id === real.id,
  'A real item must win over the matching demo capability.');
assert((development.glance?.length ?? 0) >= 4, 'Partial API response must retain useful development glance.');

const offline = prepareHomeDisplay(undefined, 'development', [fixture]);
assert(offline.items[0]?.id === fixture.id && offline.glance?.length,
  'Development Home must remain inspectable when the API is unavailable.');

const preview = prepareHomeDisplay({ items: [] }, 'preview', [fixture]);
assert(preview.demo_mode === true && preview.items[0]?.id === fixture.id,
  'Preview Home must show the demo capability when the API returns no items.');

const production = prepareHomeDisplay({ items: [real, fixture], glance: [{
  id: 'demo-glance', label: 'Example', value: 'Example', source_domain: 'weather', data_mode: 'demo',
}] }, 'production', [fixture]);
assert(production.demo_mode === false && production.items.length === 1 && production.items[0]?.id === real.id,
  'Production must preserve real personalized items without demo leakage.');
assert(production.glance?.length === 0, 'Production must not display demo glance.');

console.log('PASS: Home explicit demo and personalized display policy');
