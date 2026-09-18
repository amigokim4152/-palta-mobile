import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort();

const records = files.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return Array.isArray(payload.records) ? payload.records : [];
});

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const dishSignals = [
  ['completo_hotdog', /\b(completo|completos|vienesa|vianesa|perro caliente|hot dog)\b/],
  ['churrasco_lomito_sandwich', /\b(churrasco|lomito|sandwich|sándwich|chacarero|barros luco|italiano|luco)\b/],
  ['burger', /\b(hamburguesa|hamburger|burger|cheeseburger)\b/],
  ['pizza', /\b(pizza|pizzas|margherita)\b/],
  ['sushi_roll', /\b(sushi|roll|rolls|handroll|maki|hosomaki|nigiri|sashimi|sake|ebi|tori)\b/],
  ['chicken', /\b(pollo|pechuga|tutro|chicken|alitas|broaster)\b/],
  ['ceviche', /\b(ceviche|ceviches|acevichad[oa])\b/],
  ['seafood', /\b(marisco|mariscos|ostra|ostras|ostion|ostiones|macha|machas|jaiba|salmon|salmón|reineta|camaron|camarón|pescado)\b/],
  ['rice_dish', /\b(arroz|chaufa|chaufan|chaufán|gohan|dopbap|bibimbap)\b/],
  ['noodle_dish', /\b(tallarin|tallarín|fideo|fideos|ramen|chaumin|japchae|fettuccine)\b/],
  ['empanada_pastry_savoury', /\b(empanada|empanadas|tequeno|tequeño|tequenos|tequeños|sopaipilla|sopaipillas|gyoza|gyozas|mandu)\b/],
  ['shawarma_kebab', /\b(shawarma|shawerma|kebab|falafel|kubbe|kibbe|babaganoush)\b/],
  ['arepa', /\b(arepa|arepas|cachapa|cachapas)\b/],
  ['salad_bowl_wrap', /\b(ensalada|ensaladas|bowl|wrap|wraps|poke)\b/],
  ['chilean_home_cooking', /\b(pastel de choclo|pastel de papas|guatitas|plateada|mechada|causeo|cochayuyo|chorrillana)\b/],
  ['bakery', /\b(pan|brioche|croissant|masa madre|marraqueta|hallulla)\b/],
  ['pastry_cake', /\b(torta|tortas|kuchen|muffin|muffins|brownie|cheesecake|waffle|waffles|rollo canela|rollito de canela)\b/],
  ['ice_cream', /\b(helado|helados|gelato)\b/],
  ['coffee_tea', /\b(cafe|café|espresso|expresso|latte|cappuccino|chai|te|té)\b/],
];

const formatSignals = [
  ['two_for_one', /\b(2x1|2 x 1)\b/],
  ['combo', /\b(combo|combos)\b/],
  ['promotion', /\b(promo|promocion|promoción|oferta|ahorro|imbatible|ding dong)\b/],
  ['family_share', /\b(familiar|familia|para dos|para 2|para 3|para tres|para 4|para cuatro|compartir|parrillada)\b/],
  ['pack_box', /\b(pack|box|caja)\b/],
  ['menu_meal', /\b(menu|menú|colacion|colación|plato del dia|plato del día)\b/],
  ['build_your_own', /\b(arma tu|a eleccion|a elección)\b/],
  ['portion_volume', /\b(kg|gr|gramos|lt|litro|piezas|bocados|unidades|uds|ud)\b/],
];

const counts = (keys) => Object.fromEntries(keys.map(([key]) => [key, 0]));
const dishCounts = counts(dishSignals);
const formatCounts = counts(formatSignals);
const categoryCounts = new Map();
const cuisineDishPairs = new Map();
const unmatched = [];
let totalItems = 0;
let matchedItems = 0;
let multiDishItems = 0;
let multiFormatItems = 0;

for (const record of records) {
  const platformCategories = record.listing?.platform_categories ?? [];
  for (const category of platformCategories) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  for (const item of record.menu_snapshot?.sample_items ?? []) {
    totalItems += 1;
    const text = normalize(item.name);
    const dishes = dishSignals.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
    const formats = formatSignals.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);

    if (dishes.length) {
      matchedItems += 1;
      if (dishes.length > 1) multiDishItems += 1;
      for (const dish of dishes) dishCounts[dish] += 1;
      for (const category of platformCategories) {
        for (const dish of dishes) {
          const key = `${category} -> ${dish}`;
          cuisineDishPairs.set(key, (cuisineDishPairs.get(key) ?? 0) + 1);
        }
      }
    } else {
      unmatched.push({
        outlet: record.outlet?.brand_name,
        comuna: record.outlet?.comuna,
        item: item.name,
        platformCategories,
      });
    }

    if (formats.length > 1) multiFormatItems += 1;
    for (const format of formats) formatCounts[format] += 1;
  }
}

const topEntries = (map, limit) => [...map.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
  .slice(0, limit)
  .map(([key, count]) => ({ key, count }));

const result = {
  observedOutlets: records.length,
  totalItems,
  provisionalDishSignalCoverage: totalItems ? Number((matchedItems / totalItems).toFixed(4)) : 0,
  unmatchedItemCount: unmatched.length,
  multiDishItemCount: multiDishItems,
  multiFormatItemCount: multiFormatItems,
  provisionalDishSignals: dishCounts,
  commerceFormatSignals: formatCounts,
  topPlatformTags: topEntries(categoryCounts, 30),
  topPlatformTagToDishSignals: topEntries(cuisineDishPairs, 50),
  unmatchedSample: unmatched.slice(0, 80),
  interpretation: [
    'Dish signals are provisional research labels, not consumer navigation.',
    'Items may match multiple dish signals; this is intentional.',
    'Platform tags are compared with item signals to expose noisy/overloaded categories.',
    'Unmatched items are retained to drive taxonomy expansion rather than being forced into Other.',
  ],
};

console.log(JSON.stringify(result, null, 2));
