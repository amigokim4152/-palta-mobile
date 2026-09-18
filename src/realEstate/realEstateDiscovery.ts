import type {
  ListingPublisherType,
  PropertyTransactionType,
  PropertyType,
} from './realEstateContracts';

export type RealEstateDiscoveryView = 'list' | 'map';

export type RealEstateDiscoveryFilters = {
  transactionType: PropertyTransactionType;
  propertyType?: PropertyType;
  publisherType?: ListingPublisherType;
  minPriceClp?: number;
  maxPriceClp?: number;
};

export const REAL_ESTATE_TRANSACTION_LABELS: Record<PropertyTransactionType, string> = {
  sale: 'Venta',
  rent: 'Arriendo',
  temporary_rent: 'Temporal',
};

export const REAL_ESTATE_PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Departamento',
  house: 'Casa',
  room: 'Pieza',
  office: 'Oficina',
  commercial: 'Local comercial',
  land: 'Terreno',
  parcel: 'Parcela',
  warehouse: 'Bodega',
};

export const REAL_ESTATE_PUBLISHER_LABELS: Record<ListingPublisherType, string> = {
  owner_direct: 'Dueño directo',
  broker: 'Corredor',
  real_estate_business: 'Inmobiliaria',
};

export function formatListingPrice(input: { priceClp?: number; priceUf?: number }): string {
  if (input.priceUf !== undefined) {
    return `UF ${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(input.priceUf)}`;
  }
  if (input.priceClp !== undefined) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(input.priceClp);
  }
  return 'Precio a consultar';
}

export function formatPropertyFacts(input: {
  bedrooms?: number;
  bathrooms?: number;
  usableAreaM2?: number;
}): string {
  return [
    input.bedrooms !== undefined ? `${input.bedrooms} dorm.` : undefined,
    input.bathrooms !== undefined ? `${input.bathrooms} baños` : undefined,
    input.usableAreaM2 !== undefined ? `${input.usableAreaM2} m²` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}
