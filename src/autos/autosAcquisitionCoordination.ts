export type VehicleCoordinationContactConsent = 'private' | 'share_selected_dealer';
export type VehicleCoordinationLocationConsent = 'private' | 'share_selected_dealer';
export type VehicleInspectionVenueMode = 'dealer_location' | 'seller_location';

export type VehiclePrivateCoordinationDetails = {
  phone?: string;
  exactLocation?: {
    latitude: number;
    longitude: number;
    label?: string;
  };
};

export type VehicleAcquisitionCoordinationSelection = {
  acquisitionRequestId: string;
  selectedOfferId: string;
  selectedBusinessId: string;
  selectedAt: string;
  contactConsent: VehicleCoordinationContactConsent;
  locationConsent: VehicleCoordinationLocationConsent;
};

export type VehicleInspectionCoordinationPlan = {
  venueMode: VehicleInspectionVenueMode;
  scheduledAt: string;
  contactConsent: VehicleCoordinationContactConsent;
  locationConsent: VehicleCoordinationLocationConsent;
};

export type VehicleDealerCoordinationProjection = {
  acquisitionRequestId: string;
  businessId: string;
  selected: boolean;
  phone?: string;
  exactLocation?: {
    latitude: number;
    longitude: number;
    label?: string;
  };
};

export function validateVehicleCoordinationSelection(
  selection: VehicleAcquisitionCoordinationSelection,
  details: VehiclePrivateCoordinationDetails,
): { valid: boolean; reason?: string } {
  if (!selection.acquisitionRequestId || !selection.selectedOfferId || !selection.selectedBusinessId) {
    return { valid: false, reason: 'request, offer and selected Business are required.' };
  }

  if (selection.contactConsent === 'share_selected_dealer' && !details.phone?.trim()) {
    return { valid: false, reason: 'Phone is required before contact can be shared.' };
  }

  if (selection.locationConsent === 'share_selected_dealer') {
    const location = details.exactLocation;
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      return { valid: false, reason: 'Valid exact location is required before location can be shared.' };
    }
  }

  return { valid: true };
}

export function validateVehicleInspectionCoordination(
  plan: VehicleInspectionCoordinationPlan,
  details: VehiclePrivateCoordinationDetails,
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(Date.parse(plan.scheduledAt))) {
    return { valid: false, reason: 'Inspection schedule must use a valid timestamp.' };
  }

  if (plan.venueMode === 'dealer_location' && plan.locationConsent !== 'private') {
    return {
      valid: false,
      reason: 'Dealer-location inspection must not share the seller exact location.',
    };
  }

  if (plan.venueMode === 'seller_location' && plan.locationConsent !== 'share_selected_dealer') {
    return {
      valid: false,
      reason: 'Seller-location inspection requires explicit selected-dealer location consent.',
    };
  }

  return validateVehicleCoordinationSelection(
    {
      acquisitionRequestId: 'inspection-validation',
      selectedOfferId: 'inspection-validation',
      selectedBusinessId: 'inspection-validation',
      selectedAt: plan.scheduledAt,
      contactConsent: plan.contactConsent,
      locationConsent: plan.locationConsent,
    },
    details,
  );
}

/**
 * Private coordination data is projected only to the Business whose offer the person selected.
 * Losing bidders never receive contact or exact location, even if the seller chose to share those
 * details with the selected dealer.
 */
export function projectVehicleCoordinationForDealer(
  selection: VehicleAcquisitionCoordinationSelection,
  details: VehiclePrivateCoordinationDetails,
  dealerBusinessId: string,
): VehicleDealerCoordinationProjection {
  const selected = dealerBusinessId === selection.selectedBusinessId;
  if (!selected) {
    return {
      acquisitionRequestId: selection.acquisitionRequestId,
      businessId: dealerBusinessId,
      selected: false,
    };
  }

  return {
    acquisitionRequestId: selection.acquisitionRequestId,
    businessId: dealerBusinessId,
    selected: true,
    ...(selection.contactConsent === 'share_selected_dealer' && details.phone?.trim()
      ? { phone: details.phone.trim() }
      : {}),
    ...(selection.locationConsent === 'share_selected_dealer' && details.exactLocation
      ? { exactLocation: { ...details.exactLocation } }
      : {}),
  };
}
