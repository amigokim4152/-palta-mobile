import type { VehicleListingView } from '../../../../src/autos/autosContracts';

export const AUTOS_DEMO_LISTINGS: readonly VehicleListingView[] = [
  {
    vehicle: {
      id: 'vehicle-demo-rav4-2021',
      make: 'Toyota',
      model: 'RAV4',
      version: '2.0 CVT',
      year: 2021,
      bodyType: 'suv',
      transmission: 'automatic',
      fuel: 'gasoline',
    },
    listing: {
      id: 'auto-demo-rav4-las-condes',
      vehicleId: 'vehicle-demo-rav4-2021',
      title: 'Toyota RAV4 2.0 CVT 2021',
      priceClp: 18990000,
      mileageKm: 48200,
      comuna: 'Las Condes',
      sector: 'El Golf',
      sellerType: 'owner_direct',
      verifiedSeller: true,
      publishedAt: '2026-09-17T15:30:00-03:00',
      imageUrls: [
        'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['Único dueño', 'Mantenciones al día', '2 llaves'],
      description:
        'SUV de uso familiar, cuidado y con mantenciones realizadas según kilometraje. Se muestra en Las Condes con coordinación previa.',
    },
  },
  {
    vehicle: {
      id: 'vehicle-demo-mg-zs-2023',
      make: 'MG',
      model: 'ZS',
      version: '1.5 Comfort',
      year: 2023,
      bodyType: 'suv',
      transmission: 'manual',
      fuel: 'gasoline',
    },
    listing: {
      id: 'auto-demo-mg-zs-providencia',
      vehicleId: 'vehicle-demo-mg-zs-2023',
      title: 'MG ZS 1.5 Comfort 2023',
      priceClp: 11990000,
      mileageKm: 21800,
      comuna: 'Providencia',
      sector: 'Pedro de Valdivia',
      sellerType: 'dealer',
      publisherBusinessId: 'demo-business-auto-providencia',
      verifiedSeller: true,
      publishedAt: '2026-09-18T09:10:00-03:00',
      imageUrls: [
        'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['Financiamiento', 'Garantía del vendedor', 'Recibe vehículo en parte de pago'],
      description:
        'Unidad seleccionada de concesionario demo. La publicación distingue claramente inventario profesional de venta directa entre personas.',
    },
  },
  {
    vehicle: {
      id: 'vehicle-demo-yaris-2020',
      make: 'Toyota',
      model: 'Yaris',
      version: '1.5 Sport',
      year: 2020,
      bodyType: 'sedan',
      transmission: 'manual',
      fuel: 'gasoline',
    },
    listing: {
      id: 'auto-demo-yaris-nunoa',
      vehicleId: 'vehicle-demo-yaris-2020',
      title: 'Toyota Yaris 1.5 Sport 2020',
      priceClp: 9990000,
      mileageKm: 61700,
      comuna: 'Ñuñoa',
      sector: 'Plaza Ñuñoa',
      sellerType: 'owner_direct',
      verifiedSeller: false,
      publishedAt: '2026-09-16T18:45:00-03:00',
      imageUrls: [
        'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['Buen consumo', 'Uso particular', 'Sin modificaciones'],
      description:
        'Sedán compacto de uso particular. Buen candidato para quien prioriza costo de operación y tamaño urbano.',
    },
  },
  {
    vehicle: {
      id: 'vehicle-demo-hilux-2022',
      make: 'Toyota',
      model: 'Hilux',
      version: '2.8 4x4 AT',
      year: 2022,
      bodyType: 'pickup',
      transmission: 'automatic',
      fuel: 'diesel',
    },
    listing: {
      id: 'auto-demo-hilux-maipu',
      vehicleId: 'vehicle-demo-hilux-2022',
      title: 'Toyota Hilux 2.8 4x4 AT 2022',
      priceClp: 27900000,
      mileageKm: 55300,
      comuna: 'Maipú',
      sector: 'Ciudad Satélite',
      sellerType: 'dealer',
      publisherBusinessId: 'demo-business-auto-maipu',
      verifiedSeller: true,
      publishedAt: '2026-09-15T12:20:00-03:00',
      imageUrls: [
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['4x4', 'Diésel', 'Inspección disponible'],
      description:
        'Pickup 4x4 orientada a trabajo y uso mixto. Publicación demo para validar filtros por carrocería, combustible y vendedor profesional.',
    },
  },
  {
    vehicle: {
      id: 'vehicle-demo-niro-2022',
      make: 'Kia',
      model: 'Niro',
      version: 'Hybrid EX',
      year: 2022,
      bodyType: 'suv',
      transmission: 'automatic',
      fuel: 'hybrid',
    },
    listing: {
      id: 'auto-demo-niro-vitacura',
      vehicleId: 'vehicle-demo-niro-2022',
      title: 'Kia Niro Hybrid EX 2022',
      priceClp: 19900000,
      mileageKm: 33600,
      comuna: 'Vitacura',
      sector: 'Lo Castillo',
      sellerType: 'owner_direct',
      verifiedSeller: true,
      publishedAt: '2026-09-18T13:00:00-03:00',
      imageUrls: [
        'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1200&q=80',
      ],
      highlights: ['Híbrido', 'Uso urbano', 'Cámara de retroceso'],
      description:
        'Vehículo híbrido de uso urbano, publicado por su dueño. Demo para probar búsquedas por combustible y zona.',
    },
  },
];

export function findAutosDemoListing(listingId: string) {
  return AUTOS_DEMO_LISTINGS.find((item) => item.listing.id === listingId);
}
