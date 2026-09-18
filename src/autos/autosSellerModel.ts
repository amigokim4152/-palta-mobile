export type VehicleSaleMode =
  | 'owner_direct'
  | 'dealer_inventory'
  | 'brokered_consignment';

export type VehiclePublisher =
  | {
      actorType: 'person';
      userId: string;
    }
  | {
      actorType: 'business';
      businessId: string;
    };

export type VehicleSellerAuthorityStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'revoked';

export type VehicleListingPublisherRelationship = {
  listingId: string;
  vehicleId: string;
  saleMode: VehicleSaleMode;
  publisher: VehiclePublisher;
  sellerAuthorityStatus: VehicleSellerAuthorityStatus;
  representationAuthorizationId?: string;
};

export type VehicleRepresentationAuthorizationStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'rejected';

export type VehicleRepresentationAuthorization = {
  id: string;
  vehicleId: string;
  grantingUserId: string;
  representativeBusinessId: string;
  status: VehicleRepresentationAuthorizationStatus;
  createdAt: string;
  startsAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  evidenceRef?: string;
};

export type VehicleBusinessCapability =
  | 'vehicle_inventory_publish'
  | 'vehicle_inventory_bulk_manage'
  | 'vehicle_lead_inbox'
  | 'vehicle_team_access'
  | 'vehicle_analytics'
  | 'vehicle_trade_in_offer'
  | 'vehicle_private_buy_bid'
  | 'vehicle_consignment_manage'
  | 'vehicle_inspection_publish'
  | 'vehicle_finance_referral'
  | 'vehicle_transfer_support';

export type VehicleAcquisitionRequestStatus =
  | 'draft'
  | 'routing'
  | 'open_for_offers'
  | 'offer_selected'
  | 'closed'
  | 'cancelled';

export type VehicleAcquisitionRequest = {
  id: string;
  vehicleId: string;
  requesterUserId: string;
  status: VehicleAcquisitionRequestStatus;
  comuna?: string;
  createdAt: string;
  closesAt?: string;
};

export type VehicleBusinessOfferStatus =
  | 'submitted'
  | 'revised'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'withdrawn';

export type VehicleBusinessOfferKind = 'preliminary' | 'firm';

export type VehicleBusinessOffer = {
  id: string;
  acquisitionRequestId: string;
  businessId: string;
  amountClp: number;
  status: VehicleBusinessOfferStatus;
  submittedAt: string;
  expiresAt?: string;
  note?: string;
  kind?: VehicleBusinessOfferKind;
  inspectionRequired?: boolean;
};

export type VehicleOfferAdjustmentReason =
  | 'undisclosed_damage'
  | 'mechanical_difference'
  | 'mileage_difference'
  | 'document_difference'
  | 'other_verified_difference';

export type VehicleOfferAdjustment = {
  id: string;
  offerId: string;
  previousAmountClp: number;
  revisedAmountClp: number;
  reason: VehicleOfferAdjustmentReason;
  explanation: string;
  evidenceRefs: readonly string[];
  createdAt: string;
};

export function validateVehicleOfferAdjustment(
  adjustment: VehicleOfferAdjustment,
): { valid: boolean; reason?: string } {
  if (adjustment.previousAmountClp <= 0 || adjustment.revisedAmountClp <= 0) {
    return { valid: false, reason: 'Offer amounts must be positive.' };
  }
  if (adjustment.revisedAmountClp >= adjustment.previousAmountClp) {
    return { valid: false, reason: 'This adjustment contract is only for downward revisions.' };
  }
  if (!adjustment.explanation.trim()) {
    return { valid: false, reason: 'A downward revision requires an explanation.' };
  }
  if (adjustment.evidenceRefs.length === 0) {
    return { valid: false, reason: 'A downward revision requires inspection evidence.' };
  }
  return { valid: true };
}

export function validateVehicleListingPublisherRelationship(
  relationship: VehicleListingPublisherRelationship,
): { valid: boolean; reason?: string } {
  if (
    relationship.saleMode === 'owner_direct' &&
    relationship.publisher.actorType !== 'person'
  ) {
    return {
      valid: false,
      reason: 'owner_direct requires a person publisher.',
    };
  }

  if (
    relationship.saleMode === 'dealer_inventory' &&
    relationship.publisher.actorType !== 'business'
  ) {
    return {
      valid: false,
      reason: 'dealer_inventory requires a canonical Business publisher.',
    };
  }

  if (relationship.saleMode === 'brokered_consignment') {
    if (relationship.publisher.actorType !== 'business') {
      return {
        valid: false,
        reason: 'brokered_consignment requires a canonical Business publisher.',
      };
    }
    if (!relationship.representationAuthorizationId) {
      return {
        valid: false,
        reason:
          'brokered_consignment requires an explicit representation authorization reference.',
      };
    }
  }

  if (
    relationship.saleMode !== 'brokered_consignment' &&
    relationship.representationAuthorizationId
  ) {
    return {
      valid: false,
      reason:
        'representation authorization belongs only to brokered_consignment listings.',
    };
  }

  return { valid: true };
}
