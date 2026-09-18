import { useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { RealEstateListingQuery } from '../../../../src/realEstate/realEstateRepository';
import { createSavedSearch } from '../../../../src/realEstate/realEstateUserState';
import { ExpoSQLiteRealEstateUserStateStore } from '../../adapters/expoSqliteRealEstateUserStateStore';
import { PaltaButton } from '../../components/common/PaltaButton';

function stableSearchId(query: RealEstateListingQuery): string {
  const value = JSON.stringify(query);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `real-estate-search-${(hash >>> 0).toString(16)}`;
}

function searchLabel(query: RealEstateListingQuery): string {
  const parts = [
    query.text?.trim(),
    query.transactionType === 'rent'
      ? 'Arriendo'
      : query.transactionType === 'sale'
        ? 'Venta'
        : query.transactionType === 'temporary_rent'
          ? 'Temporal'
          : undefined,
    query.minBedrooms ? `${query.minBedrooms}+ dorm.` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Búsqueda de propiedades';
}

export function SaveRealEstateSearchButton({ query }: { query: RealEstateListingQuery }) {
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateUserStateStore(db), [db]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await store.saveSearch(createSavedSearch({
        id: stableSearchId(query),
        label: searchLabel(query),
        query,
        alertEnabled: false,
      }));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PaltaButton
      label={saved ? 'Búsqueda guardada' : 'Guardar búsqueda'}
      variant="secondary"
      loading={saving}
      disabled={saved}
      onPress={() => void save()}
    />
  );
}
