import type { MarketId } from './marketPersistenceContract.js';
import {
  marketVerticalByKey,
  type MarketCanonicalDomain,
  type MarketVerticalKey,
} from './marketVerticalPolicy.js';

/**
 * Mercado is the transaction/discovery envelope. Structured vehicle and real
 * estate truth remains owned by the canonical vertical domain.
 *
 * These links intentionally carry identifiers only. They must not embed a
 * VehicleIdentity, VehicleListing, Property, PropertyListing or Business.
 */
export type MarketVehicleDomainLink = {
  marketListingId: MarketId;
  vertical: 'vehicles';
  canonicalDomain: 'autos';
  /** src/autos VehicleListing.id */
  vehicleListingId: string;
  /** src/autos VehicleIdentity.id / VehicleListing.vehicleId */
  vehicleId: string;
};

export type MarketPropertyDomainLink = {
  marketListingId: MarketId;
  vertical: 'property';
  canonicalDomain: 'real_estate';
  /** src/realEstate PropertyListing.id */
  propertyListingId: string;
  /** src/realEstate Property.id / PropertyListing.propertyId */
  propertyId: string;
};

export type MarketDomainListingLink =
  | MarketVehicleDomainLink
  | MarketPropertyDomainLink;

export type MarketDomainListingLinkReadPort = {
  getByMarketListingId(
    marketListingId: MarketId,
  ): Promise<MarketDomainListingLink | null>;
};

function assertNonBlankId(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty canonical id.`);
  }
}

/**
 * Validates only the cross-domain identity relationship. Domain-specific facts
 * such as make/model/year/mileage or bedrooms/area must be resolved from the
 * owning Autos/Real Estate domain rather than copied into Mercado policy.
 */
export function assertMarketDomainListingLink(
  link: MarketDomainListingLink,
): void {
  assertNonBlankId(link.marketListingId, 'Market listing id');
  const policy = marketVerticalByKey(link.vertical);
  if (!policy.canonicalDomain) {
    throw new Error(`Mercado vertical ${link.vertical} has no canonical domain.`);
  }
  if (policy.canonicalDomain !== link.canonicalDomain) {
    throw new Error(
      `Mercado vertical ${link.vertical} must link to ${policy.canonicalDomain}.`,
    );
  }

  if (link.canonicalDomain === 'autos') {
    assertNonBlankId(link.vehicleListingId, 'Autos vehicle listing id');
    assertNonBlankId(link.vehicleId, 'Autos vehicle id');
    return;
  }

  assertNonBlankId(link.propertyListingId, 'Real Estate property listing id');
  assertNonBlankId(link.propertyId, 'Real Estate property id');
}

export function canonicalDomainForMarketVertical(
  vertical: MarketVerticalKey,
): MarketCanonicalDomain | undefined {
  return marketVerticalByKey(vertical).canonicalDomain;
}

export function marketVerticalUsesCanonicalDomain(
  vertical: MarketVerticalKey,
): boolean {
  return canonicalDomainForMarketVertical(vertical) !== undefined;
}
