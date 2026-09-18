import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MarketTransactionView } from '../../../../src/market/marketApiContract';
import {
  canTransitionMarketListing,
  marketListingStatusMeta,
  type MarketListingStatus,
} from '../../../../src/market/marketLifecycle';
import type {
  MarketListingRecord,
} from '../../../../src/market/marketPersistenceContract';
import {
  canUseManualListingDisposition,
  marketCounterpartyLabel,
  marketCounterpartyTrustLabel,
  marketSellerCoordinationForListing,
} from '../../../../src/market/marketSellerCoordination';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

export function MyMarketListingsScreen() {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [listings, setListings] = useState<MarketListingRecord[]>([]);
  const [transactions, setTransactions] = useState<MarketTransactionView[]>([]);
  const [loading, setLoading] = useState(Boolean(runtime.read));
  const [error, setError] = useState<string | undefined>(
    runtime.read ? undefined : runtime.unavailableReason,
  );
  const [mutatingId, setMutatingId] = useState<string | undefined>();

  async function load() {
    if (!runtime.read) return;
    setLoading(true);
    setError(undefined);
    try {
      const [listingPage, transactionPage] = await Promise.all([
        runtime.read.listMyListings({ limit: 50 }),
        runtime.read.listMyTransactions({ limit: 50 }),
      ]);
      setListings(listingPage.items);
      setTransactions(transactionPage.items);
    } catch {
      setError('No pudimos cargar tus publicaciones.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [runtime]);

  async function transitionListingManually(
    listing: MarketListingRecord,
    next: MarketListingStatus,
  ) {
    if (!runtime.mutation || !canTransitionMarketListing(listing.status, next)) return;
    setMutatingId(listing.id);
    setError(undefined);
    try {
      await runtime.mutation.transitionListing({
        listingId: listing.id,
        expectedVersion: listing.version,
        toStatus: next,
      });
      await load();
    } catch {
      setError('No pudimos cambiar el estado de esta publicación.');
    } finally {
      setMutatingId(undefined);
    }
  }

  function confirmManualTransition(
    listing: MarketListingRecord,
    next: MarketListingStatus,
  ) {
    const sold = next === 'sold';
    Alert.alert(
      sold ? 'Venta por otro medio' : 'Reserva por otro medio',
      sold
        ? 'Usa esta opción si la venta se coordinó fuera de Palta. No creará una transacción ni una reseña dentro de Palta.'
        : 'Usa esta opción si reservaste el artículo fuera de Palta. No se vinculará a una conversación de Palta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: sold ? 'Marcar vendido' : 'Marcar reservado',
          onPress: () => void transitionListingManually(listing, next),
        },
      ],
    );
  }

  async function reserveFor(transaction: MarketTransactionView) {
    if (!runtime.mutation || transaction.status !== 'coordinating') return;
    setMutatingId(transaction.id);
    setError(undefined);
    try {
      await runtime.mutation.reserveTransaction({ transactionId: transaction.id });
      await load();
    } catch {
      setError('No pudimos reservar el artículo para esta persona.');
    } finally {
      setMutatingId(undefined);
    }
  }

  async function cancelReservation(transaction: MarketTransactionView) {
    if (!runtime.mutation || transaction.status !== 'reserved') return;
    setMutatingId(transaction.id);
    setError(undefined);
    try {
      await runtime.mutation.cancelTransaction({ transactionId: transaction.id });
      await load();
    } catch {
      setError('No pudimos cancelar esta reserva.');
    } finally {
      setMutatingId(undefined);
    }
  }

  async function completeTransaction(transaction: MarketTransactionView) {
    if (!runtime.mutation || transaction.status !== 'reserved') return;
    setMutatingId(transaction.id);
    setError(undefined);
    try {
      await runtime.mutation.completeTransaction({ transactionId: transaction.id });
      await load();
    } catch {
      setError('No pudimos confirmar la entrega.');
    } finally {
      setMutatingId(undefined);
    }
  }

  async function openConversation(transaction: MarketTransactionView) {
    if (!runtime.messaging || !transaction.conversationId) {
      setError('La conversación no está disponible en este momento.');
      return;
    }
    setMutatingId(transaction.id);
    setError(undefined);
    try {
      await runtime.messaging.openConversation({
        conversationId: transaction.conversationId,
        focus: {
          sourceCore: 'market',
          resourceType: 'market_transaction',
          resourceId: transaction.id,
          label: transaction.listingSnapshot.title,
        },
      });
    } catch {
      setError('No pudimos abrir la conversación.');
    } finally {
      setMutatingId(undefined);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerTextBlock}>
          <Text style={styles.heading}>Mis publicaciones</Text>
          <Text style={styles.subheading}>
            Reserva y completa cada venta con la persona correcta.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {runtime.mode === 'development_preview' ? (
          <View style={styles.previewNotice}>
            <Text style={styles.previewNoticeTitle}>Vista previa de desarrollo</Text>
            <Text style={styles.previewNoticeBody}>
              Los cambios se guardan sólo en la sesión de desarrollo.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Cargando tus publicaciones…</Text>
          </View>
        ) : null}

        {!loading && listings.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Todavía no tienes publicaciones</Text>
            <Text style={styles.stateBody}>
              Publica un artículo y podrás administrar aquí su disponibilidad.
            </Text>
          </View>
        ) : null}

        {listings.map((listing) => {
          const firstMedia = listing.media[0];
          const imageUrl = firstMedia
            ? runtime.resolveMediaAssetUrl(firstMedia.mediaAssetId)
            : undefined;
          const coordination = marketSellerCoordinationForListing({
            listing,
            transactions,
          });
          const manualDisposition = canUseManualListingDisposition({
            listing,
            coordination,
          });
          const completedTransaction = coordination.completed[0];
          const listingBusy = mutatingId === listing.id;

          return (
            <View key={listing.id} style={styles.card}>
              <View style={styles.summaryRow}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}>
                    <Text style={styles.imagePlaceholderText}>Sin foto</Text>
                  </View>
                )}
                <View style={styles.summaryBody}>
                  <Text numberOfLines={2} style={styles.title}>
                    {listing.title}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {marketListingStatusMeta[listing.status].label}
                    </Text>
                  </View>
                  <Text style={styles.locationText}>{listing.location.comunaName}</Text>
                </View>
              </View>

              {coordination.reserved ? (
                <View style={styles.reservationCard}>
                  <Text style={styles.transactionEyebrow}>RESERVADO EN PALTA</Text>
                  <Text style={styles.transactionName}>
                    {marketCounterpartyLabel(coordination.reserved)}
                  </Text>
                  {marketCounterpartyTrustLabel(coordination.reserved) ? (
                    <Text style={styles.transactionMeta}>
                      {marketCounterpartyTrustLabel(coordination.reserved)}
                    </Text>
                  ) : null}
                  <View style={styles.transactionActions}>
                    {coordination.reserved.conversationId ? (
                      <Pressable
                        disabled={mutatingId === coordination.reserved.id}
                        onPress={() => void openConversation(coordination.reserved!)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>Mensaje</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      disabled={mutatingId === coordination.reserved.id}
                      onPress={() => void cancelReservation(coordination.reserved!)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>Cancelar reserva</Text>
                    </Pressable>
                    <Pressable
                      disabled={mutatingId === coordination.reserved.id}
                      onPress={() => void completeTransaction(coordination.reserved!)}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Confirmar entrega</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {!coordination.reserved && coordination.coordinating.length > 0 ? (
                <View style={styles.interestSection}>
                  <Text style={styles.interestHeading}>
                    {coordination.coordinating.length === 1
                      ? '1 persona está coordinando'
                      : `${coordination.coordinating.length} personas están coordinando`}
                  </Text>
                  <Text style={styles.interestHint}>
                    Reserva sólo cuando hayas acordado la entrega con una persona.
                  </Text>
                  {coordination.coordinating.map((transaction) => {
                    const transactionBusy = mutatingId === transaction.id;
                    const trust = marketCounterpartyTrustLabel(transaction);
                    return (
                      <View key={transaction.id} style={styles.interestRow}>
                        <View style={styles.interestBody}>
                          <Text style={styles.transactionName}>
                            {marketCounterpartyLabel(transaction)}
                          </Text>
                          {trust ? (
                            <Text style={styles.transactionMeta}>{trust}</Text>
                          ) : (
                            <Text style={styles.transactionMeta}>
                              Conversación vinculada a esta publicación
                            </Text>
                          )}
                        </View>
                        <View style={styles.compactActions}>
                          {transaction.conversationId ? (
                            <Pressable
                              disabled={transactionBusy}
                              onPress={() => void openConversation(transaction)}
                              style={styles.smallSecondaryButton}
                            >
                              <Text style={styles.smallSecondaryText}>Mensaje</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            disabled={transactionBusy}
                            onPress={() => void reserveFor(transaction)}
                            style={styles.smallPrimaryButton}
                          >
                            <Text style={styles.smallPrimaryText}>Reservar</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {manualDisposition ? (
                <View style={styles.manualSection}>
                  <Text style={styles.manualLabel}>¿Lo coordinaste fuera de Palta?</Text>
                  <View style={styles.transactionActions}>
                    {listing.status === 'active' ? (
                      <Pressable
                        disabled={listingBusy}
                        onPress={() => confirmManualTransition(listing, 'reserved')}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>Reservado por otro medio</Text>
                      </Pressable>
                    ) : null}
                    {listing.status === 'reserved' ? (
                      <Pressable
                        disabled={listingBusy}
                        onPress={() => void transitionListingManually(listing, 'active')}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>Volver a disponible</Text>
                      </Pressable>
                    ) : null}
                    {canTransitionMarketListing(listing.status, 'sold') ? (
                      <Pressable
                        disabled={listingBusy}
                        onPress={() => confirmManualTransition(listing, 'sold')}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>Vendido por otro medio</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {completedTransaction ? (
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewText}>Transacción completada en Palta</Text>
                  <Pressable
                    onPress={() =>
                      router.push(`/market/review/${completedTransaction.id}`)
                    }
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Dejar reseña</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <Pressable onPress={() => router.push('/market/sell')} style={styles.newListingButton}>
          <Text style={styles.newListingPlus}>＋</Text>
          <Text style={styles.newListingText}>Publicar otro artículo</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: paltaTheme.color.textPrimary, fontSize: 36, lineHeight: 38 },
  headerTextBlock: { flex: 1, paddingRight: 12 },
  heading: { color: paltaTheme.color.textPrimary, fontSize: 20, fontWeight: '800' },
  subheading: {
    marginTop: 2,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
  },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  previewNotice: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.brandSoft,
    padding: 13,
  },
  previewNoticeTitle: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  previewNoticeBody: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  errorCard: {
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 12,
  },
  errorText: { color: paltaTheme.color.danger, fontSize: 12, lineHeight: 17 },
  stateCard: {
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    padding: 24,
    alignItems: 'center',
  },
  stateTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 6,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  card: {
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    overflow: 'hidden',
  },
  summaryRow: { flexDirection: 'row', gap: 12, padding: 12 },
  image: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryBody: { flex: 1, minHeight: 88 },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  locationText: {
    marginTop: 'auto',
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  reservationCard: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandSoft,
    padding: 12,
  },
  transactionEyebrow: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 10,
    fontWeight: '900',
  },
  transactionName: {
    marginTop: 3,
    color: paltaTheme.color.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  transactionMeta: {
    marginTop: 2,
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  transactionActions: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  interestSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paltaTheme.color.divider,
    padding: 12,
    gap: 8,
  },
  interestHeading: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  interestHint: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  interestRow: {
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  interestBody: { flex: 1 },
  compactActions: { flexDirection: 'row', gap: 6 },
  smallSecondaryButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    paddingHorizontal: 9,
    backgroundColor: paltaTheme.color.surface,
  },
  smallSecondaryText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  smallPrimaryButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    paddingHorizontal: 10,
  },
  smallPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  manualSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paltaTheme.color.divider,
    padding: 10,
  },
  manualLabel: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    paddingHorizontal: 12,
    backgroundColor: paltaTheme.color.surface,
  },
  secondaryButtonText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    paddingHorizontal: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  reviewSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paltaTheme.color.divider,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewText: {
    flex: 1,
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
  },
  newListingButton: {
    minHeight: 52,
    marginTop: 4,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  newListingPlus: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 18,
    marginRight: 4,
  },
  newListingText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
