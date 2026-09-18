import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { ExpoSQLiteRealEstateUserStateStore } from '../../adapters/expoSqliteRealEstateUserStateStore';

export function useSavedRealEstateListings() {
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateUserStateStore(db), [db]);
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await store.listSavedListings();
      setSavedIds(new Set(rows.map((row) => row.listingId)));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSaved = useCallback(async (listingId: string) => {
    const isSaved = savedIds.has(listingId);
    if (isSaved) {
      await store.removeSavedListing(listingId);
    } else {
      await store.saveListing(listingId);
    }
    setSavedIds((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }, [savedIds, store]);

  return {
    loading,
    savedIds,
    isSaved: (listingId: string) => savedIds.has(listingId),
    toggleSaved,
    refresh,
  };
}
