import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SavedRealEstateSearch } from '../../../../src/realEstate/realEstateUserState';
import { ExpoSQLiteRealEstateUserStateStore } from '../../adapters/expoSqliteRealEstateUserStateStore';

export function useSavedRealEstateSearches() {
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateUserStateStore(db), [db]);
  const [searches, setSearches] = useState<readonly SavedRealEstateSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSearches(await store.listSavedSearches());
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(async (searchId: string) => {
    await store.removeSavedSearch(searchId);
    setSearches((current) => current.filter((item) => item.id !== searchId));
  }, [store]);

  const setAlertPreference = useCallback(async (searchId: string, enabled: boolean) => {
    const existing = searches.find((item) => item.id === searchId);
    if (!existing) return;
    const next: SavedRealEstateSearch = {
      ...existing,
      alertEnabled: enabled,
    };
    await store.saveSearch(next);
    setSearches((current) => current.map((item) => item.id === searchId ? next : item));
  }, [searches, store]);

  return { searches, loading, refresh, remove, setAlertPreference };
}
