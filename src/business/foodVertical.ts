export type FoodVerticalCategoryId =
  | 'all'
  | 'burgers'
  | 'pizza'
  | 'sushi'
  | 'chicken'
  | 'peruvian'
  | 'chilean'
  | 'korean'
  | 'chinese'
  | 'cafe'
  | 'bakery'
  | 'dessert'
  | 'vegetarian';

export type FoodVerticalCategory = Readonly<{
  id: FoodVerticalCategoryId;
  label: string;
  queryTerms: readonly string[];
  categoryKeys?: readonly string[];
  matchTerms?: readonly string[];
}>;

/**
 * Consumer-first food shortcuts for Santiago. These are discovery intents, not
 * a replacement taxonomy for canonical Business. One Business stays canonical;
 * this layer only changes how a food-ordering intent is projected and searched.
 */
export const FOOD_VERTICAL_CATEGORIES: readonly FoodVerticalCategory[] = [
  {
    id: 'all',
    label: 'Todo',
    queryTerms: ['comida', 'restaurante', 'café', 'panadería'],
  },
  {
    id: 'burgers',
    label: 'Hamburguesas',
    queryTerms: ['hamburguesa', 'burger'],
    matchTerms: ['hamburguesa', 'burger'],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    queryTerms: ['pizza', 'pizzería'],
    matchTerms: ['pizza', 'pizzeria'],
  },
  {
    id: 'sushi',
    label: 'Sushi',
    queryTerms: ['sushi', 'japonés'],
    matchTerms: ['sushi', 'japones', 'japonesa'],
  },
  {
    id: 'chicken',
    label: 'Pollo',
    queryTerms: ['pollo', 'pollo asado', 'pollo frito'],
    matchTerms: ['pollo'],
  },
  {
    id: 'peruvian',
    label: 'Peruana',
    queryTerms: ['comida peruana', 'restaurante peruano'],
    matchTerms: ['peruana', 'peruano', 'ceviche'],
  },
  {
    id: 'chilean',
    label: 'Chilena',
    queryTerms: ['comida chilena', 'cocina chilena'],
    matchTerms: ['chilena', 'chileno', 'empanada', 'completo'],
  },
  {
    id: 'korean',
    label: 'Coreana',
    queryTerms: ['comida coreana', 'restaurante coreano'],
    matchTerms: ['coreana', 'coreano', 'kimchi', 'korean'],
  },
  {
    id: 'chinese',
    label: 'China',
    queryTerms: ['comida china', 'restaurante chino'],
    matchTerms: ['china', 'chino', 'cantones'],
  },
  {
    id: 'cafe',
    label: 'Cafés',
    queryTerms: ['café', 'cafetería'],
    categoryKeys: ['cafe'],
    matchTerms: ['cafe', 'cafeteria', 'coffee'],
  },
  {
    id: 'bakery',
    label: 'Panadería',
    queryTerms: ['panadería', 'pastelería'],
    categoryKeys: ['bakery'],
    matchTerms: ['panaderia', 'pasteleria', 'pan'],
  },
  {
    id: 'dessert',
    label: 'Postres',
    queryTerms: ['postres', 'helado', 'pastelería'],
    matchTerms: ['postre', 'helado', 'pasteleria', 'dulce'],
  },
  {
    id: 'vegetarian',
    label: 'Vegetariana',
    queryTerms: ['vegetariano', 'vegano'],
    matchTerms: ['vegetariana', 'vegetariano', 'vegana', 'vegano', 'vegan'],
  },
] as const;

const FOOD_CATEGORY_KEYS = new Set(['restaurant', 'cafe', 'bakery']);
const FOOD_GENERIC_TERMS = [
  'comida',
  'restaurant',
  'restaurante',
  'cafe',
  'cafeteria',
  'panaderia',
  'pasteleria',
  'pizza',
  'sushi',
  'hamburguesa',
  'burger',
  'pollo',
  'ceviche',
  'empanada',
  'postre',
  'helado',
] as const;

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/\s+/g, ' ')
    .trim();
}

function foodSearchText(input: {
  name?: string;
  serviceLabels?: readonly string[];
}): string {
  return normalize([input.name, ...(input.serviceLabels ?? [])].filter(Boolean).join(' '));
}

export function getFoodVerticalCategory(
  categoryId: FoodVerticalCategoryId,
): FoodVerticalCategory {
  return (
    FOOD_VERTICAL_CATEGORIES.find((category) => category.id === categoryId) ??
    FOOD_VERTICAL_CATEGORIES[0]!
  );
}

export function buildFoodVerticalQuery(input: {
  categoryId: FoodVerticalCategoryId;
  freeText?: string;
}): string {
  const category = getFoodVerticalCategory(input.categoryId);
  const freeText = input.freeText?.trim();
  return [...category.queryTerms, ...(freeText ? [freeText] : [])].join(' ');
}

export function isFoodVerticalBusiness(input: {
  categoryKey?: string;
  name?: string;
  serviceLabels?: readonly string[];
}): boolean {
  if (input.categoryKey && FOOD_CATEGORY_KEYS.has(input.categoryKey)) return true;
  const text = foodSearchText(input);
  return FOOD_GENERIC_TERMS.some((term) => text.includes(term));
}

export function matchesFoodVerticalCategory(
  categoryId: FoodVerticalCategoryId,
  input: {
    categoryKey?: string;
    name?: string;
    serviceLabels?: readonly string[];
  },
): boolean {
  if (!isFoodVerticalBusiness(input)) return false;
  if (categoryId === 'all') return true;

  const category = getFoodVerticalCategory(categoryId);
  if (
    input.categoryKey &&
    category.categoryKeys?.includes(input.categoryKey)
  ) {
    return true;
  }

  const text = foodSearchText(input);
  const terms = category.matchTerms ?? category.queryTerms;
  return terms.some((term) => text.includes(normalize(term)));
}

/**
 * Local Business owns only the discovery intent. The actual order lifecycle is
 * handed to the shared Commerce Core rather than duplicated in this feature.
 */
export type FoodOrderIntent = Readonly<{
  businessId: string;
  intent: 'food_order';
  preferredFulfillment?: 'delivery' | 'pickup' | 'dine_in';
}>;

export function createFoodOrderIntent(
  businessId: string,
  preferredFulfillment?: FoodOrderIntent['preferredFulfillment'],
): FoodOrderIntent {
  const cleanBusinessId = businessId.trim();
  if (!cleanBusinessId) throw new Error('business_id_required');
  return {
    businessId: cleanBusinessId,
    intent: 'food_order',
    ...(preferredFulfillment ? { preferredFulfillment } : {}),
  };
}
