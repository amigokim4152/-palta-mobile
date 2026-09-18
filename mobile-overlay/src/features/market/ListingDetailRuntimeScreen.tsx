import { router, useLocalSearchParams } from 'expo-router';
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
import { marketPriceBand } from '../../../../src/market/marketInterestSignal';
import {
  canContactMarketSeller,
  marketListingStatusMeta,
} from '../../../../src/market/marketLifecycle';
import {
  marketListingVerticalOf,
  type MarketPublicListing,
} from '../../../../src/market/marketPersistenceContract';
import {
  buildMarketHideListingIntent,
  buildMarketReportListingIntent,
  type MarketSafetyReportReason,
} from '../../../../src/market/marketSafetyIntent';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

function formatPrice(listing: MarketPublicListing) {
  if (listing.tradeMode === 'free') return 'Gratis';
  if (listing.tradeMode === 'wanted') return 'Busco';
  if (listing.tradeMode === 'exchange') return 'Intercambio';
  if (typeof listing.priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(listing.priceClp)}`;
}

const reportReasonLabels: Array<{
  reason: MarketSafetyReportReason;
  label: string;
}> = [
  { reason: 'suspected_scam', label: 'Posible estafa' },
  { reason: 'prohibited_item', label: 'Artículo no permitido' },
  { reason: 'spam', label: 'Spam o publicación repetida' },
  { reason: 'misleading_listing', label: 'Información engañosa' },
  { reason: 'harassment', label: 'Acoso o comportamiento inapropiado' },
  { reason: 'other', label: 'Otro motivo' },
];

export function ListingDetailRuntimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [listing, setListing] = useState<MarketPublicListing | null>();
  const [favorite, setFavorite] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!id || !runtime.read) {
      setListing(null);
      setError(runtime.unavailableReason ?? 'Mercado no está disponible.');
      return;
    }
    let active = true;
    setError(undefined);
    Promise.all([
      runtime.read.getPublicListing(id),
      runtime.read.getMyFavoriteState(id).catch(() => false),
    ])
      .then(([nextListing, nextFavorite]) => {
        if (!active) return;
        setListing(nextListing);
        setFavorite(nextFavorite);
        setFavoriteCount(nextListing?.favoriteCount ?? 0);
      })
      .catch(() => {
        if (!active) return;
        setListing(null);
        setError('No pudimos cargar esta publicación.');
      });
    return () => {
      active = false;
    };
  }, [id, runtime]);

  async function toggleFavorite() {
    if (!listing || !runtime.mutation || savingFavorite) return;
    const next = !favorite;
    setSavingFavorite(true);
    try {
      const result = await runtime.mutation.setFavorite({
        listingId: listing.id,
        favorite: next,
      });
      setFavorite(result.favorite);
      setFavoriteCount((count) => Math.max(0, count + (result.favorite ? 1 : -1)));

      if (result.favorite) {
        const priceBand = marketPriceBand(listing.priceClp);
        void runtime.recordInterestSignal?.({
          action: 'favorite',
          occurredAt: new Date().toISOString(),
          vertical: marketListingVerticalOf(listing),
          category: listing.category,
          listingId: listing.id,
          ...(priceBand ? { priceBand } : {}),
        });
      }
    } catch {
      Alert.alert('Mercado', 'No pudimos actualizar tus favoritos.');
    } finally {
      setSavingFavorite(false);
    }
  }

  async function hideListing() {
    if (!listing || safetyBusy) return;
    setSafetyBusy(true);
    try {
      if (runtime.handleSafetyIntent) {
        await runtime.handleSafetyIntent(
          buildMarketHideListingIntent({
            listingId: listing.id,
            sellerActorId: listing.seller.sellerUserId,
          }),
        );
      } else if (runtime.mode !== 'development_preview') {
        Alert.alert('Mercado', 'No pudimos ocultar esta publicación en este momento.');
        return;
      }
      router.back();
    } catch {
      Alert.alert('Mercado', 'No pudimos ocultar esta publicación. Intenta nuevamente.');
    } finally {
      setSafetyBusy(false);
    }
  }

  async function reportListing(reason: MarketSafetyReportReason) {
    if (!listing || safetyBusy) return;
    setSafetyBusy(true);
    try {
      if (runtime.handleSafetyIntent) {
        await runtime.handleSafetyIntent(
          buildMarketReportListingIntent({
            listingId: listing.id,
            sellerActorId: listing.seller.sellerUserId,
            reason,
          }),
        );
      } else if (runtime.mode !== 'development_preview') {
        Alert.alert('Mercado', 'No pudimos enviar el reporte en este momento.');
        return;
      }
      Alert.alert('Gracias', 'Recibimos tu reporte.');
    } catch {
      Alert.alert('Mercado', 'No pudimos enviar el reporte. Intenta nuevamente.');
    } finally {
      setSafetyBusy(false);
    }
  }

  function openReportMenu() {
    Alert.alert(
      'Reportar publicación',
      'Selecciona el motivo que mejor describa el problema.',
      [
        ...reportReasonLabels.map(({ reason, label }) => ({
          text: label,
          onPress: () => void reportListing(reason),
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  }

  function openSafetyMenu() {
    Alert.alert('Publicación', undefined, [
      { text: 'Ocultar publicación', onPress: () => void hideListing() },
      { text: 'Reportar', style: 'destructive', onPress: openReportMenu },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  if (listing === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Cargando publicación…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Publicación no disponible</Text>
          {error ? <Text style={styles.stateBody}>{error}</Text> : null}
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Volver a Mercado</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const firstMedia = listing.media[0];
  const imageUrl = firstMedia
    ? runtime.resolveMediaAssetUrl(firstMedia.mediaAssetId)
    : undefined;
  const contactEnabled = canContactMarketSeller(listing.status);
  const statusMeta = marketListingStatusMeta[listing.status];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerOverlay}>
        <Pressable onPress={() => router.back()} style={styles.circleButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            disabled={!runtime.mutation || savingFavorite}
            onPress={toggleFavorite}
            style={styles.circleButton}
          >
            <Text style={[styles.iconText, favorite && styles.favoriteActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
          <Pressable
            disabled={safetyBusy}
            onPress={openSafetyMenu}
            style={styles.circleButton}
          >
            <Text style={styles.iconText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>Sin foto</Text>
          </View>
        )}

        <View style={styles.content}>
          <Pressable style={styles.sellerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {listing.seller.displayName.slice(0, 1)}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.seller.displayName}</Text>
              <Text style={styles.sellerMeta}>{listing.location.comunaName}</Text>
              <Text style={styles.sellerSubmeta}>
                {listing.seller.neighborhoodVerified
                  ? 'Barrio verificado'
                  : 'Perfil local'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.trustGrid}>
            <View style={styles.trustItem}>
              <Text style={styles.trustValue}>{listing.seller.completedTrades}</Text>
              <Text style={styles.trustLabel}>intercambios completados</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItemWide}>
              <Text style={styles.trustValueSmall}>
                {listing.seller.responseLabel ?? 'Respuesta todavía sin historial'}
              </Text>
              <Text style={styles.trustLabel}>Señal de confianza</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.title}>{listing.title}</Text>
          <View
            style={[
              styles.statusPill,
              listing.status === 'reserved' && styles.statusPillReserved,
            ]}
          >
            <Text style={styles.statusText}>{statusMeta.label}</Text>
          </View>
          <Text style={styles.meta}>
            {listing.location.comunaName}
            {typeof listing.distanceKm === 'number'
              ? ` · ${listing.distanceKm.toFixed(1).replace('.', ',')} km`
              : ''}
          </Text>

          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.activityRow}>
            <Text style={styles.activityText}>
              {favorite ? '♥' : '♡'} {favoriteCount} interesados
            </Text>
            {typeof listing.chatCount === 'number' ? (
              <Text style={styles.activityText}>{listing.chatCount} chats</Text>
            ) : null}
          </View>

          <View style={styles.safetyBox}>
            <Text style={styles.safetyTitle}>Intercambia con calma</Text>
            <Text style={styles.safetyBody}>
              Coordina el punto de encuentro por mensaje. Palta muestra la zona, no la dirección exacta del vendedor.
            </Text>
          </View>

          {listing.status === 'reserved' ? (
            <View style={styles.reservedNotice}>
              <Text style={styles.reservedNoticeTitle}>Este artículo está reservado</Text>
              <Text style={styles.reservedNoticeBody}>
                Puedes consultar al vendedor, pero otra persona está coordinando la compra.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          disabled={!runtime.mutation || savingFavorite}
          onPress={toggleFavorite}
          style={styles.favoriteButton}
        >
          <Text style={[styles.favoriteText, favorite && styles.favoriteActive]}>
            {favorite ? '♥' : '♡'}
          </Text>
        </Pressable>
        <View style={styles.priceBlock}>
          <Text
            style={[
              styles.price,
              listing.tradeMode === 'free' && styles.freePrice,
            ]}
          >
            {formatPrice(listing)}
          </Text>
          <Text style={styles.priceHint}>Precio publicado</Text>
        </View>
        <Pressable
          disabled={!contactEnabled}
          onPress={() => router.push(`/market/message/${listing.id}`)}
          style={[
            styles.messageButton,
            !contactEnabled && styles.messageButtonDisabled,
          ]}
        >
          <Text style={styles.messageButtonText}>
            {contactEnabled ? 'Mensaje' : 'Finalizado'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 8,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    zIndex: 2,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  backGlyph: {
    color: paltaTheme.color.textPrimary,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -2,
  },
  iconText: { color: paltaTheme.color.textPrimary, fontSize: 22 },
  favoriteActive: { color: paltaTheme.color.brandPrimary },
  heroImage: {
    width: '100%',
    aspectRatio: 1.05,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: {
    color: paltaTheme.color.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  content: { padding: 18, paddingBottom: 124 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: paltaTheme.color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sellerInfo: { flex: 1, marginLeft: 12 },
  sellerName: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  sellerMeta: {
    marginTop: 2,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  sellerSubmeta: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  chevron: { color: paltaTheme.color.textMuted, fontSize: 25 },
  trustGrid: {
    marginTop: 14,
    padding: 14,
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  trustItem: { width: 92, justifyContent: 'center' },
  trustItemWide: { flex: 1, justifyContent: 'center' },
  trustDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: paltaTheme.color.border,
    marginHorizontal: 14,
  },
  trustValue: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  trustValueSmall: {
    color: paltaTheme.color.textPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  trustLabel: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paltaTheme.color.divider,
    marginVertical: 20,
  },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillReserved: { backgroundColor: paltaTheme.color.surfaceMuted },
  statusText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  meta: {
    marginTop: 8,
    color: paltaTheme.color.textMuted,
    fontSize: 13,
  },
  description: {
    marginTop: 20,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 23,
  },
  activityRow: { marginTop: 18, flexDirection: 'row', gap: 14 },
  activityText: { color: paltaTheme.color.textMuted, fontSize: 12 },
  safetyBox: {
    marginTop: 24,
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 14,
  },
  safetyTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  safetyBody: {
    marginTop: 5,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  reservedNotice: {
    marginTop: 14,
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    padding: 14,
  },
  reservedNoticeTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  reservedNoticeBody: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paltaTheme.color.divider,
    backgroundColor: paltaTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: paltaTheme.color.divider,
    marginRight: 14,
  },
  favoriteText: { color: paltaTheme.color.textSecondary, fontSize: 25 },
  priceBlock: { flex: 1 },
  price: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  freePrice: { color: paltaTheme.color.brandPrimary },
  priceHint: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  messageButton: {
    minWidth: 112,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonDisabled: { opacity: 0.45 },
  messageButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
});