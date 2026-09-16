export type ServiceDomain =
  | 'home'
  | 'vehicle'
  | 'health'
  | 'education'
  | 'insurance'
  | 'legal_admin'
  | 'pets'
  | 'mobility'
  | 'events'
  | 'commerce'
  | 'other';

export type ServiceCategory = {
  id: string;
  domain: ServiceDomain;
  name: string;
  quoteSupported: boolean;
  bookingSupported: boolean;
  emergencySensitive: boolean;
  regulated: boolean;
};

export type ServiceProviderIdentity = {
  providerId: string;
  businessId: string;
  categoryIds: readonly string[];
  serviceAreaIds: readonly string[];
  verified: boolean;
};
