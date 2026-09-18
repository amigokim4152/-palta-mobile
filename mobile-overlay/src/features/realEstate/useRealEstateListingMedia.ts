import { useEffect, useState } from 'react';
import type {
  RealEstateListingMedia,
  RealEstateMediaRepository,
} from '../../../../src/realEstate/realEstateMedia';
import { defaultRealEstateMediaRepository } from './defaultRealEstateMediaRepository';

export function useRealEstateListingMedia(
  listingId: string,
  repository: RealEstateMediaRepository = defaultRealEstateMediaRepository,
) {
  const [media, setMedia] = useState<RealEstateListingMedia | null>(null);
  const [loading, setLoading] = useState(Boolean(listingId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!listingId) {
      setMedia(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void repository.getForListing(listingId)
      .then((result) => {
        if (active) setMedia(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setMedia(null);
        setError(reason instanceof Error ? reason.message : 'No pudimos cargar las imágenes de esta propiedad.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingId, repository]);

  return { media, loading, error };
}
