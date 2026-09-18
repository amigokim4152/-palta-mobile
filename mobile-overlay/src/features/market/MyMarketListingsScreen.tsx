import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  canTransitionMarketListing,
  marketListingStatusMeta,
  type MarketListingStatus,
} from '../../../../src/market/marketLifecycle';
import type {
  MarketListingRecord,
  MarketTransactionRecord,
} from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

function actionLabel(status: MarketListingStatus) {
  if (status === 'active') return 'Marcar reservado';
  if (status === 'reserved') return 'Volver a disponible';
  return undefined;
}

export function MyMarketListingsScreen() {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [listings, setListings] = useState<MarketListingRecord[]>([]);
  const [transactions, setTransactions] = useState<MarketTransactionRecord[]>([]);
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

  async function transition(listing: MarketListingRecord, next: MarketListingStatus) {
    if (!runtime.mutation || !canTransitionMarketListing(listing.status, next)) return;
    setMutatingId(listing.id);
    try {
      const updated = await runtime.mutation.transitionListing({
        listingId: listing.id,
        expectedVersion: listing.version,
        toStatus: next,
      });
      setListings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError('No pudimos cambiar el estado de esta publicación.');
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
          <Text style={styles.subheading}>Gestiona el estado sin volver a publicar.</Text>
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
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Mercado no está disponible</Text>
            <Text style={styles.stateBody}>{error}</Text>
          </View>
        ) : null}

        {!error && loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Cargando tus publicaciones…</Text>
          </View>
        ) : null}

        {!error && !loading && listings.length === 0 ? (
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
          const secondaryAction = actionLabel(listing.status);
          const secondaryTarget: MarketListingStatus | undefined =
            listing.status === 'active'
              ? 'reserved'
              : listing.status === 'reserved'
                ? 'active'
                : undefined;
          const canMarkSold = canTransitionMarketListing(listing.status, 'sold');
          const completedTransaction = transactions.find(
            (transaction) =>
              transaction.listingId === listing.id &&
              transaction.status === 'completed',
          );
          const busy = mutatingId === listing.id;

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

              <View style={styles.actions}>
                {secondaryAction && secondaryTarget ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => transition(listing, secondaryTarget)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{secondaryAction}</Text>
                  </Pressable>
                ) : null}

                {canMarkSold ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => transition(listing, 'sold')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Marcar vendido</Text>
                  </Pressable>
                ) : null}

                {completedTransaction ? (
                  <Pressable
                    onPress={() =>
                      router.push(`/market/review/${completedTransaction.id}`)
                    }
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Dejar reseña</Text>
                  </Pressable>
                ) : null}
              </View>
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
  actions: {
    padding: 10,
    paddingTop: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    paddingHorizontal: 12,
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
