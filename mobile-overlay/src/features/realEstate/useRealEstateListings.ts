import { useEffect, useState } from 'react';
import type {
  RealEstateListingQuery,
  RealEstateListingRepository,
  RealEstateListingSearchItem,
} from '../../../../src/realEstate/realEstateRepository';
import { demoRealEstateListingRepository } from './demoRealEstateListingRepository';

export function useRealEstateListings(
  query: RealEstateListingQuery,
  repository: RealEstateListingRepository = demoRealEstateListingRepository,
) {
  const [listings, setListings] = useState<readonly RealEstateListingSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void repository.search(query)
      .then((result) => {
        if (active) setListings(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setListings([]);
        setError(reason instanceof Error ? reason.message : 'No pudimos cargar propiedades.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, repository]);

  return { listings, loading, error };
}
