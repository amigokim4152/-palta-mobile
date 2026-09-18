import { useEffect, useState } from 'react';
import type {
  RealEstateContextRepository,
  RealEstatePropertyContext,
} from '../../../../src/realEstate/realEstateContext';
import { defaultRealEstateContextRepository } from './defaultRealEstateContextRepository';

export function useRealEstatePropertyContext(
  propertyId: string,
  repository: RealEstateContextRepository = defaultRealEstateContextRepository,
) {
  const [context, setContext] = useState<RealEstatePropertyContext | null>(null);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!propertyId) {
      setContext(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void repository.getByPropertyId(propertyId)
      .then((result) => {
        if (active) setContext(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setContext(null);
        setError(reason instanceof Error ? reason.message : 'No pudimos cargar el contexto de esta propiedad.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [propertyId, repository]);

  return { context, loading, error };
}
