import { PaltaApiClient } from '../src/api/paltaApiClient.js';
import { careStateLabel } from '../src/care/careTimeline.js';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  businessVerificationLabel,
  careT,
  createLanguageContext,
  discoveryT,
  resolveLocalizedContent,
  resolvePreferredLocale,
  resolveSignedInLocalePreference,
  surfaceT,
  t,
  tryNormalizeLocale,
} from '../src/localization/index.js';
import { marketVerticalByKey } from '../src/market/marketVerticalPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(DEFAULT_LOCALE === 'es-CL', 'Spanish (Chile) must remain the canonical default locale.');
assert(tryNormalizeLocale('ko-KR') === 'ko', 'Korean device locale should normalize to ko.');
assert(tryNormalizeLocale('en-US') === 'en', 'English device locale should normalize to en.');
assert(tryNormalizeLocale('zh-CN') === 'zh-Hans', 'Simplified Chinese device locale should normalize to zh-Hans.');
assert(tryNormalizeLocale('pt-BR') === null, 'Unsupported locale must not be coerced to another translated locale.');

assert(
  resolvePreferredLocale({ deviceLocales: ['ko-KR'] }) === 'ko',
  'Korean device should see Korean when there is no explicit account preference.',
);
assert(
  resolvePreferredLocale({
    storedLocale: 'es-CL',
    storedLocaleExplicit: false,
    deviceLocales: ['ko-KR'],
  }) === 'ko',
  'Database default Spanish must not override a Korean device before the user explicitly chooses Spanish.',
);
assert(
  resolvePreferredLocale({
    storedLocale: 'es-CL',
    storedLocaleExplicit: true,
    deviceLocales: ['ko-KR'],
  }) === 'es-CL',
  'An explicit account language must override the device language.',
);

const signedInRemote = resolveSignedInLocalePreference({
  remoteLocale: 'en',
  remoteExplicit: true,
  localExplicitLocale: 'ko',
  deviceLocales: ['zh-CN'],
});
assert(
  signedInRemote.locale === 'en' && !signedInRemote.promoteLocalToAccount,
  'An explicit account locale must win after sign-in.',
);
const signedInLocal = resolveSignedInLocalePreference({
  remoteLocale: 'es-CL',
  remoteExplicit: false,
  localExplicitLocale: 'ko-KR',
  deviceLocales: ['en-US'],
});
assert(
  signedInLocal.locale === 'ko' && signedInLocal.promoteLocalToAccount,
  'A pre-auth explicit local choice must be promoted when the account has no explicit locale.',
);
const signedInDevice = resolveSignedInLocalePreference({
  remoteLocale: 'es-CL',
  remoteExplicit: false,
  deviceLocales: ['zh-CN'],
});
assert(
  signedInDevice.locale === 'zh-Hans' && !signedInDevice.promoteLocalToAccount,
  'Device locale should win only when there is no explicit remote or local choice.',
);

assert(t('nav.home', 'ko') === '홈', 'Korean tab label should resolve.');
assert(t('nav.home', 'en') === 'Home', 'English tab label should resolve.');
assert(t('nav.home', 'zh-Hans') === '首页', 'Chinese tab label should resolve.');
assert(t('nav.home', 'es-CL') === 'Inicio', 'Spanish tab label should remain canonical.');
assert(
  t('home.showMore', 'ko', { count: 3 }) === '3개 더 보기',
  'Korean UI interpolation should preserve locale-specific word order.',
);
assert(
  t('home.showMore', 'es-CL', { count: 3 }) === 'Ver 3 más',
  'Spanish UI interpolation should resolve runtime values.',
);
assert(
  discoveryT('market.vertical.property', 'ko') === '부동산',
  'Market vertical labels should resolve through the feature catalog.',
);
assert(
  discoveryT('market.publishIn', 'en', { category: 'Vehicles' }) ===
    'Post in Vehicles',
  'Feature copy should support runtime interpolation.',
);
const propertyVertical = marketVerticalByKey('property');
assert(
  !('title' in propertyVertical),
  'Market policy must remain language-neutral; display titles belong to localization catalogs.',
);
assert(
  careStateLabel('follow_up', 'zh-Hans') === '后续处理',
  'Care state labels should resolve in Simplified Chinese.',
);
assert(
  careT('care.state', 'ko', { state: '기다리는 중' }) ===
    '현재 상태: 기다리는 중',
  'Care copy should preserve locale-specific interpolation order.',
);
assert(
  surfaceT('context.subtitle', 'ko', { id: 'travel-001' }) ===
    '임시 문맥 · travel-001',
  'Secondary surfaces should share the selected Palta locale.',
);
assert(
  surfaceT('async.retry', 'zh-Hans') === '重试',
  'Shared async controls should not fall back to Spanish when a translation exists.',
);
assert(
  businessVerificationLabel('verified', 'ko') === '인증됨',
  'Business verification status should use the selected Palta locale.',
);

const requestedUrls: string[] = [];
const localizedApi = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      status: 200,
      async json() {
        if (url.includes('/v1/local/search')) {
          return {
            items: [
              {
                entity_id: 'biz-pharmacy-1',
                entity_type: 'business',
                entity_type_label: '동네업체',
                name: 'Farmacia ejemplo',
                category_key: 'pharmacy',
                category_label: '약국',
                verification_status: 'verified',
                location: { lat: -33.39, lng: -70.57 },
              },
              {
                entity_id: 'public-service-1',
                entity_type: 'public_service',
                entity_type_label: '공공 서비스',
                name: 'Atención municipal ejemplo',
                category_key: 'municipal_service',
                category_label: '구청 서비스',
                location: { lat: -33.391, lng: -70.571 },
              },
              {
                entity_id: 'event-1',
                entity_type: 'event',
                entity_type_label: '행사',
                name: 'Feria vecinal de ejemplo',
                location: { lat: -33.392, lng: -70.572 },
              },
            ],
          };
        }
        if (url.includes('/v1/business/')) {
          return {
            id: 'biz-pharmacy-1',
            name: 'Farmacia ejemplo',
            category_key: 'pharmacy',
            category_label: '药房',
            verification_status: 'verified',
            opening_status: 'open',
            opening_status_label: '营业中',
          };
        }
        return { items: [] };
      },
    };
  },
});

const localizedSearch = await localizedApi.searchLocal({
  latitude: -33.39,
  longitude: -70.57,
  locale: 'ko',
});
assert(
  requestedUrls[0]?.includes('locale=ko'),
  'Local search must forward the selected Palta locale when supplied.',
);
assert(
  localizedSearch[0]?.category_key === 'pharmacy' &&
    localizedSearch[0]?.category_label === '약국' &&
    localizedSearch[0]?.entity_type_label === '동네업체',
  'Localized business search results must preserve canonical keys and additive display labels.',
);
assert(
  localizedSearch[1]?.entity_type === 'public_service' &&
    localizedSearch[1]?.entity_type_label === '공공 서비스' &&
    localizedSearch[1]?.category_key === 'municipal_service' &&
    localizedSearch[1]?.category_label === '구청 서비스',
  'Public-service search results must keep canonical taxonomy alongside localized labels.',
);
assert(
  localizedSearch[2]?.entity_type === 'event' &&
    localizedSearch[2]?.entity_type_label === '행사' &&
    localizedSearch[2]?.name === 'Feria vecinal de ejemplo',
  'Event search results must localize metadata without translating proper names.',
);

const localizedBusiness = await localizedApi.getBusiness(
  'biz-pharmacy-1',
  'zh-Hans',
);
assert(
  requestedUrls[1]?.includes('locale=zh-Hans'),
  'Business detail must forward the selected Palta locale when supplied.',
);
assert(
  localizedBusiness.category_key === 'pharmacy' &&
    localizedBusiness.category_label === '药房' &&
    localizedBusiness.opening_status === 'open' &&
    localizedBusiness.opening_status_label === '营业中',
  'Business detail must keep canonical status keys alongside localized display labels.',
);

const content = {
  original: 'Hoy cerramos a las 18:00.',
  sourceLocale: 'es-CL' as const,
  translations: {
    ko: { text: '오늘은 오후 6시에 문을 닫습니다.', status: 'reviewed' as const },
  },
};
assert(
  resolveLocalizedContent(content, 'ko').text === '오늘은 오후 6시에 문을 닫습니다.',
  'Existing requested-language content should be used.',
);
const chineseFallback = resolveLocalizedContent(content, 'zh-Hans');
assert(
  chineseFallback.text === 'Hoy cerramos a las 18:00.' && chineseFallback.usedFallback,
  'Missing translation must fall back directly to the Spanish original.',
);

const koreanContext = createLanguageContext('ko');
assert(koreanContext.region === DEFAULT_REGION && DEFAULT_REGION === 'CL', 'Locale must not change Chile region.');
assert(koreanContext.timezone === DEFAULT_TIMEZONE && DEFAULT_TIMEZONE === 'America/Santiago', 'Locale must not change Santiago timezone.');
assert(koreanContext.currency === DEFAULT_CURRENCY && DEFAULT_CURRENCY === 'CLP', 'Locale must not change CLP currency.');

console.log('PASS: localization runtime tests');
