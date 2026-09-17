import {
  projectPublicBusinessLocation,
  updateBusinessLocationAnchor,
  validateBusinessLocationProfile,
  type BusinessLocationProfile,
} from '../src/business/businessLocationProfile.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const storefront: BusinessLocationProfile = {
  businessId: 'biz-store',
  addressLabel: 'Av. Ejemplo 123, Vitacura',
  anchorPoint: { latitude: -33.39, longitude: -70.57 },
  publicPrecision: 'exact',
  serviceAreaLabels: ['Vitacura'],
};
assert(validateBusinessLocationProfile(storefront, ['storefront']).length === 0, 'storefront may expose confirmed exact point');
const publicStorefront = projectPublicBusinessLocation({ profile: storefront, presenceModes: ['storefront'] });
assert(publicStorefront.point?.latitude === -33.39, 'exact storefront projection may include its public point');

const homeBased: BusinessLocationProfile = {
  businessId: 'biz-home',
  addressLabel: 'Vitacura',
  anchorPoint: { latitude: -33.4, longitude: -70.58 },
  publicPrecision: 'area_only',
  serviceAreaLabels: ['Vitacura', 'Las Condes'],
};
const publicHome = projectPublicBusinessLocation({ profile: homeBased, presenceModes: ['private_home_base', 'service_area'] });
assert(publicHome.point === undefined, 'home-based business must not leak its precise anchor in area-only projection');
assert(publicHome.addressLabel === 'Vitacura', 'home-based business may expose a broad public area label');

const unsafeHome = { ...homeBased, publicPrecision: 'exact' as const };
assert(
  validateBusinessLocationProfile(unsafeHome, ['private_home_base']).includes('private_home_exact_location_forbidden'),
  'private home base must reject exact public location without an explicit public storefront',
);

const hidden = projectPublicBusinessLocation({
  profile: { ...homeBased, publicPrecision: 'hidden' },
  presenceModes: ['private_home_base'],
});
assert(hidden.point === undefined && hidden.addressLabel === undefined, 'hidden location must expose neither exact point nor address label');
assert(hidden.serviceAreaLabels.length === 2, 'hidden anchor may still expose declared service areas');

const moved = updateBusinessLocationAnchor(storefront, { latitude: -33.401, longitude: -70.601, accuracyM: 15 });
assert(moved.anchorPoint?.longitude === -70.601, 'Shared Location point can replace the business anchor without changing business identity');

console.log('PASS: Local Business location privacy contract');
