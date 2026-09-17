import type { LocationPoint } from '../location/locationCore.js';

export type BusinessPublicLocationPrecision = 'exact' | 'area_only' | 'hidden';

export type BusinessLocationProfile = Readonly<{
  businessId: string;
  addressLabel?: string;
  anchorPoint?: LocationPoint;
  publicPrecision: BusinessPublicLocationPrecision;
  serviceAreaLabels: readonly string[];
  updatedAt?: string;
}>;

export type BusinessPublicLocationProjection = Readonly<{
  addressLabel?: string;
  point?: LocationPoint;
  serviceAreaLabels: readonly string[];
}>;

const PRIVATE_HOME_MODES = new Set(['private_home_base', 'home_base']);
const EXACT_PUBLIC_MODES = new Set(['storefront', 'fixed_stand', 'fixed_location']);

function pointIsValid(point: LocationPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    (point.accuracyM === undefined || (Number.isFinite(point.accuracyM) && point.accuracyM >= 0))
  );
}

export function validateBusinessLocationProfile(
  profile: BusinessLocationProfile,
  presenceModes: readonly string[] = [],
): readonly string[] {
  const issues: string[] = [];
  if (!profile.businessId.trim()) issues.push('business_id_required');
  if (profile.addressLabel && profile.addressLabel.trim().length > 240) issues.push('address_label_too_long');
  if (profile.anchorPoint && !pointIsValid(profile.anchorPoint)) issues.push('anchor_point_invalid');
  if (profile.serviceAreaLabels.length > 20) issues.push('service_area_limit_exceeded');
  if (profile.serviceAreaLabels.some((item) => !item.trim() || item.trim().length > 120)) {
    issues.push('service_area_label_invalid');
  }

  const hasPrivateHome = presenceModes.some((mode) => PRIVATE_HOME_MODES.has(mode));
  const hasExplicitPublicPlace = presenceModes.some((mode) => EXACT_PUBLIC_MODES.has(mode));
  if (profile.publicPrecision === 'exact' && hasPrivateHome && !hasExplicitPublicPlace) {
    issues.push('private_home_exact_location_forbidden');
  }
  if (profile.publicPrecision === 'exact' && !profile.anchorPoint) {
    issues.push('exact_location_requires_anchor');
  }
  return [...new Set(issues)];
}

export function projectPublicBusinessLocation(input: {
  profile: BusinessLocationProfile;
  presenceModes?: readonly string[];
}): BusinessPublicLocationProjection {
  const issues = validateBusinessLocationProfile(input.profile, input.presenceModes ?? []);
  if (issues.length) throw new Error(`invalid_business_location:${issues.join(',')}`);

  if (input.profile.publicPrecision === 'hidden') {
    return { serviceAreaLabels: [...input.profile.serviceAreaLabels] };
  }

  if (input.profile.publicPrecision === 'area_only') {
    return {
      ...(input.profile.addressLabel?.trim() ? { addressLabel: input.profile.addressLabel.trim() } : {}),
      serviceAreaLabels: [...input.profile.serviceAreaLabels],
    };
  }

  return {
    ...(input.profile.addressLabel?.trim() ? { addressLabel: input.profile.addressLabel.trim() } : {}),
    ...(input.profile.anchorPoint ? { point: input.profile.anchorPoint } : {}),
    serviceAreaLabels: [...input.profile.serviceAreaLabels],
  };
}

export function updateBusinessLocationAnchor(
  profile: BusinessLocationProfile,
  point: LocationPoint,
): BusinessLocationProfile {
  if (!pointIsValid(point)) throw new Error('anchor_point_invalid');
  return { ...profile, anchorPoint: point };
}
