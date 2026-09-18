import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  canReviewMarketTransaction,
  canTransitionMarketListing,
  marketListingStatusMeta,
  type MarketListingStatus,
} from '../../../../src/market/marketLifecycle';
import { paltaTheme } from '../../theme/paltaTheme';
import { marketPreviewListings } from './marketPreviewData';

const ownedPreviewIds = [
  'preview-bike-01',
  'preview-chair-02',
  'preview-camera-03',
] as const;

type OwnedStatusMap = Record<string, MarketListingStatus>;

function actionLabel(status: MarketListingStatus) {
  if (status === 'active') return 'Marcar reservado';
  if (status === 'reserved') return 'Volver a disponible';
  return undefined;
}

export function MyMarketListingsScreen() {
  const initial = useMemo<OwnedStatusMap>(() => {
    const map: OwnedStatusMap = {};
    for (const id of ownedPreviewIds) {
      const listing = marketPreviewListings.find((item) => item.id === id);
      if (listing) map[id] = listing.status;
    }
    return map;
  }, []);
  const [statuses, setStatuses] = useState<OwnedStatusMap>(initial);

  const listings = ownedPreviewIds
    .map((id) => marketPreviewListings.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  function transition(id: string, next: MarketListingStatus) {
    setStatuses((current) => {
      const from = current[id];
      if (!from || !canTransitionMarketListing(from, next)) return current;
      return { ...current, [id]: next };
    });
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
        {__DEV__ ? (
          <View style={styles.previewNotice}>
            <Text style={styles.previewNoticeTitle}>Vista previa de desarrollo</Text>
            <Text style={styles.previewNoticeBody}>
              Los cambios de estado son locales. En producción se guardarán en Mercado Core.
            </Text>
          </View>
        ) : null}

        {listings.map((listing) => {
          const status = statuses[listing.id] ?? listing.status;
          const secondaryAction = actionLabel(status);
          const secondaryTarget: MarketListingStatus | undefined =
            status === 'active'
              ? 'reserved'
              : status === 'reserved'
                ? 'active'
                : undefined;
          const canMarkSold = canTransitionMarketListing(status, 'sold');

          return (
            <View key={listing.id} style={styles.card}>
              <Pressable
                onPress={() => router.push(`/market/listing/${listing.id}`)}
                style={styles.summaryRow}
              >
                <Image source={{ uri: listing.imageUrl }} style={styles.image} />
                <View style={styles.summaryBody}>
                  <Text numberOfLines={2} style={styles.title}>
                    {listing.title}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>
                      {marketListingStatusMeta[status].label}
                    </Text>
                  </View>
                  <Text style={styles.metrics}>
                    ♡ {listing.favorites} · Chats {listing.chats}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.actions}>
                {secondaryAction && secondaryTarget ? (
                  <Pressable
                    onPress={() => transition(listing.id, secondaryTarget)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{secondaryAction}</Text>
                  </Pressable>
                ) : null}

                {canMarkSold ? (
                  <Pressable
                    onPress={() => transition(listing.id, 'sold')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Marcar vendido</Text>
                  </Pressable>
                ) : null}

                {canReviewMarketTransaction(status) ? (
                  <Pressable
                    onPress={() => router.push(`/market/review/${listing.id}`)}
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
  metrics: {
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
