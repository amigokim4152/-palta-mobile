import { useEffect, useMemo, useState } from 'react';
import type {
  RealEstateListingRepository,
  RealEstateListingSearchItem,
} from '../../../../src/realEstate/realEstateRepository';
import { defaultRealEstateListingRepository } from './defaultRealEstateListingRepository';

export function useSavedRealEstateListingItems(
  savedIds: ReadonlySet<string>,
  repository: RealEstateListingRepository = defaultRealEstateListingRepository,
) {
  const ids = useMemo(() => [...savedIds].sort(), [savedIds]);
  const idsKey = ids.join('\u0000');
  const [items, setItems] = useState<readonly RealEstateListingSearchItem[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!ids.length) {
      setItems([]);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void Promise.all(ids.map((listingId) => repository.getById(listingId)))
      .then((results) => {
        if (!active) return;
        setItems(results.filter((item): item is RealEstateListingSearchItem => item !== null));
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setItems([]);
        setError(reason instanceof Error ? reason.message : 'No pudimos cargar tus propiedades guardadas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [idsKey, repository]);

  return { items, loading, error };
}
