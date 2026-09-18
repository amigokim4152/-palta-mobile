import { useEffect, useState } from 'react';
import type {
  RealEstateListingRepository,
  RealEstateListingSearchItem,
} from '../../../../src/realEstate/realEstateRepository';
import { defaultRealEstateListingRepository } from './defaultRealEstateListingRepository';

export function useRealEstateListing(
  listingId: string,
  repository: RealEstateListingRepository = defaultRealEstateListingRepository,
) {
  const [listing, setListing] = useState<RealEstateListingSearchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void repository.getById(listingId)
      .then((result) => {
        if (active) setListing(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setListing(null);
        setError(reason instanceof Error ? reason.message : 'No pudimos cargar esta propiedad.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingId, repository]);

  return { listing, loading, error };
}
