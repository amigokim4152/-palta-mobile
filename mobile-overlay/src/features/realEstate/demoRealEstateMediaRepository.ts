import {
  sortRealEstateMedia,
  type RealEstateListingMedia,
  type RealEstateMediaRepository,
} from '../../../../src/realEstate/realEstateMedia';

const MEDIA: readonly RealEstateListingMedia[] = [
  {
    listingId: 'demo-vitacura-001',
    generatedAt: '2026-09-18T12:00:00-03:00',
    items: sortRealEstateMedia([
      {
        mediaAssetId: 'media-demo-vitacura-cover',
        kind: 'image',
        role: 'cover',
        sortOrder: 0,
        width: 1600,
        height: 1200,
        altText: 'Imagen principal de prueba del departamento',
      },
      {
        mediaAssetId: 'media-demo-vitacura-gallery-1',
        kind: 'image',
        role: 'gallery',
        sortOrder: 1,
        width: 1600,
        height: 1200,
        altText: 'Imagen interior de prueba',
      },
      {
        mediaAssetId: 'media-demo-vitacura-plan',
        kind: 'floor_plan',
        role: 'floor_plan',
        sortOrder: 2,
        width: 1200,
        height: 1200,
        altText: 'Plano de prueba',
      },
    ]),
  },
  {
    listingId: 'demo-providencia-001',
    generatedAt: '2026-09-18T12:00:00-03:00',
    items: sortRealEstateMedia([
      {
        mediaAssetId: 'media-demo-providencia-cover',
        kind: 'image',
        role: 'cover',
        sortOrder: 0,
        width: 1600,
        height: 1200,
        altText: 'Imagen principal de prueba del departamento',
      },
      {
        mediaAssetId: 'media-demo-providencia-gallery-1',
        kind: 'image',
        role: 'gallery',
        sortOrder: 1,
        width: 1600,
        height: 1200,
        altText: 'Imagen interior de prueba',
      },
    ]),
  },
];

export const demoRealEstateMediaRepository: RealEstateMediaRepository = {
  async getForListing(listingId) {
    return MEDIA.find((media) => media.listingId === listingId) ?? null;
  },
};
