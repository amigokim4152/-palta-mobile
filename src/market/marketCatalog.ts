export type MarketTradeMode = 'sale' | 'rent' | 'free' | 'exchange' | 'wanted';

export type MarketCategoryKey =
  | 'all'
  | 'home'
  | 'kids'
  | 'tech'
  | 'sports'
  | 'fashion'
  | 'hobby';

/**
 * UI options for the current secondhand create flow.
 * Property rent is a canonical Mercado trade mode but is intentionally not
 * exposed by this secondhand-specific picker.
 */
export const marketTradeModes: Array<{
  key: Exclude<MarketTradeMode, 'rent'>;
  label: string;
}> = [
  { key: 'sale', label: 'Vender' },
  { key: 'free', label: 'Gratis' },
  { key: 'exchange', label: 'Intercambiar' },
  { key: 'wanted', label: 'Busco' },
];

export const marketCategories: Array<{
  key: MarketCategoryKey;
  label: string;
}> = [
  { key: 'all', label: 'Todo' },
  { key: 'home', label: 'Hogar' },
  { key: 'kids', label: 'Niños' },
  { key: 'tech', label: 'Tecnología' },
  { key: 'sports', label: 'Deportes' },
  { key: 'fashion', label: 'Moda' },
  { key: 'hobby', label: 'Hobby' },
];
