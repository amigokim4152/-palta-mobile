import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import type { RealEstateListingDraft } from '../../../../src/realEstate/realEstatePublishing';
import { ExpoSQLiteRealEstateDraftStore } from '../../adapters/expoSqliteRealEstateDraftStore';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';

function draftPrice(draft: RealEstateListingDraft): string {
  if (draft.priceUf !== undefined) return `UF ${new Intl.NumberFormat('es-CL').format(draft.priceUf)}`;
  if (draft.priceClp !== undefined) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(draft.priceClp);
  }
  return 'Precio pendiente';
}

export function MyPropertiesScreen() {
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateDraftStore(db), [db]);
  const [drafts, setDrafts] = useState<readonly RealEstateListingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDrafts(await store.listDrafts());
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function removeDraft(id: string) {
    await store.removeDraft(id);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        contentContainerStyle={{
          padding: paltaTheme.spacing.md,
          paddingBottom: 48,
          gap: paltaTheme.spacing.lg,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Mis propiedades
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            Tus borradores y, más adelante, publicaciones activas, pausadas, vendidas o arrendadas.
          </Text>
        </View>

        <PaltaButton label="Publicar otra propiedad" onPress={() => router.push('/propiedades/create')} />

        {loading ? (
          <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando borradores…</Text>
        ) : drafts.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            {drafts.map((draft) => (
              <View
                key={draft.id}
                style={{
                  padding: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.surface,
                  backgroundColor: paltaTheme.color.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.divider,
                  gap: paltaTheme.spacing.sm,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: draft.status === 'ready_for_review' ? paltaTheme.color.brandPrimary : paltaTheme.color.warning }}>
                    {draft.status === 'ready_for_review' ? 'Listo para revisión' : 'Borrador incompleto'}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
                    {REAL_ESTATE_PROPERTY_TYPE_LABELS[draft.propertyType]} · {REAL_ESTATE_TRANSACTION_LABELS[draft.transactionType]}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                    {draftPrice(draft)}
                  </Text>
                  <Text style={{ color: paltaTheme.color.textSecondary }}>
                    {[draft.sectorOrAddress, draft.comuna].filter(Boolean).join(' · ') || 'Ubicación pendiente'}
                  </Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                    {[
                      draft.usableAreaM2 !== undefined ? `${draft.usableAreaM2} m²` : undefined,
                      draft.bedrooms !== undefined ? `${draft.bedrooms} dorm.` : undefined,
                      draft.bathrooms !== undefined ? `${draft.bathrooms} baños` : undefined,
                      `${draft.photoCount} fotos demo`,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
                  <PaltaButton
                    label="Continuar / editar"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => router.push(`/propiedades/create?draftId=${encodeURIComponent(draft.id)}`)}
                  />
                  <PaltaButton
                    label="Eliminar"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => void removeDraft(draft.id)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{
              padding: paltaTheme.spacing.xl,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              gap: paltaTheme.spacing.sm,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              Todavía no tienes publicaciones
            </Text>
            <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
              Crea un borrador para probar el flujo de publicación antes de conectar el backend real.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
