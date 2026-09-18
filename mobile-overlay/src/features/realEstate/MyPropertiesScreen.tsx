import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import type { RealEstateListingDraft } from '../../../../src/realEstate/realEstatePublishing';
import { validateRealEstatePublicationReadiness } from '../../../../src/realEstate/realEstatePublicationSubmission';
import { ExpoSQLiteRealEstateDraftStore } from '../../adapters/expoSqliteRealEstateDraftStore';
import { PaltaButton } from '../../components/common/PaltaButton';
import { mobileRuntime } from '../../services/paltaClient';
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

function draftMediaLabel(draft: RealEstateListingDraft): string {
  if (draft.media?.length) return `${draft.media.length} ${draft.media.length === 1 ? 'foto' : 'fotos'}`;
  if (draft.photoCount > 0) return `${draft.photoCount} foto(s) antigua(s) · volver a cargar`;
  return 'Sin fotos';
}

export function MyPropertiesScreen() {
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateDraftStore(db), [db]);
  const [drafts, setDrafts] = useState<readonly RealEstateListingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submissionMessages, setSubmissionMessages] = useState<Record<string, string>>({});

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

  async function submitDraft(draft: RealEstateListingDraft) {
    const readiness = validateRealEstatePublicationReadiness(draft);
    if (readiness.length) {
      setSubmissionMessages((current) => ({
        ...current,
        [draft.id]: readiness.map((item) => item.message).join(' '),
      }));
      return;
    }
    if (mobileRuntime.status !== 'ready') {
      setSubmissionMessages((current) => ({
        ...current,
        [draft.id]: 'La conexión de Palta no está lista para enviar la publicación.',
      }));
      return;
    }

    setSubmittingId(draft.id);
    setSubmissionMessages((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
    try {
      const result = await mobileRuntime.client.realEstatePublication.submitDraft(draft);
      const defaultMessage = result.status === 'published'
        ? 'La propiedad ya está publicada.'
        : result.status === 'requires_verification'
          ? 'Recibimos la propiedad. Falta completar la verificación antes de activarla.'
          : 'Recibimos la propiedad y quedó pendiente de revisión.';
      setSubmissionMessages((current) => ({
        ...current,
        [draft.id]: result.message ?? defaultMessage,
      }));
    } catch (error) {
      setSubmissionMessages((current) => ({
        ...current,
        [draft.id]: error instanceof Error ? error.message : 'No pudimos enviar la publicación.',
      }));
    } finally {
      setSubmittingId(null);
    }
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
            Tus borradores y solicitudes de publicación. Palta no marca un aviso como activo hasta que el backend confirme su estado.
          </Text>
        </View>

        <PaltaButton label="Publicar otra propiedad" onPress={() => router.push('/propiedades/create')} />

        {loading ? (
          <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando borradores…</Text>
        ) : drafts.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            {drafts.map((draft) => {
              const readiness = validateRealEstatePublicationReadiness(draft);
              const submitReady = readiness.length === 0;
              const message = submissionMessages[draft.id];
              return (
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
                    <Text style={{ fontSize: 12, fontWeight: '800', color: submitReady ? paltaTheme.color.brandPrimary : paltaTheme.color.warning }}>
                      {submitReady ? 'Listo para enviar' : draft.status === 'ready_for_review' ? 'Datos listos · falta preparar publicación' : 'Borrador incompleto'}
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
                        draftMediaLabel(draft),
                      ].filter(Boolean).join(' · ')}
                    </Text>
                    {!submitReady ? (
                      <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
                        {readiness[0]?.message}
                      </Text>
                    ) : null}
                    {message ? (
                      <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                        {message}
                      </Text>
                    ) : null}
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
                  <PaltaButton
                    label={submitReady ? 'Enviar a revisión' : 'Completar antes de enviar'}
                    loading={submittingId === draft.id}
                    disabled={!submitReady || submittingId !== null}
                    onPress={() => void submitDraft(draft)}
                  />
                </View>
              );
            })}
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
              Crea un borrador, agrega fotos reales y envíalo a revisión desde aquí.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
