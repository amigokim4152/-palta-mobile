export type VehicleBodyType =
  | 'suv'
  | 'sedan'
  | 'hatchback'
  | 'pickup'
  | 'van'
  | 'coupe';

export type VehicleTransmission = 'automatic' | 'manual';
export type VehicleFuel = 'gasoline' | 'diesel' | 'hybrid' | 'electric';
export type VehicleSellerType = 'owner_direct' | 'dealer';

export interface VehicleIdentity {
  id: string;
  make: string;
  model: string;
  version?: string;
  year: number;
  bodyType: VehicleBodyType;
  transmission: VehicleTransmission;
  fuel: VehicleFuel;
}

export interface VehicleListing {
  id: string;
  vehicleId: string;
  title: string;
  priceClp: number;
  mileageKm: number;
  comuna: string;
  sector?: string;
  sellerType: VehicleSellerType;
  publisherBusinessId?: string;
  verifiedSeller?: boolean;
  publishedAt: string;
  imageUrls: readonly string[];
  highlights: readonly string[];
  description: string;
}

export interface VehicleListingView {
  vehicle: VehicleIdentity;
  listing: VehicleListing;
}
