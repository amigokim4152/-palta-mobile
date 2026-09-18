import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import {
  canContactMarketSeller,
  marketListingStatusMeta,
} from '../../../../src/market/marketLifecycle';
import { paltaTheme } from '../../theme/paltaTheme';
import { marketPreviewListings } from './marketPreviewData';
import { marketSellerTrustPreviewByListing } from './marketPreviewTrust';

function formatPrice(priceClp?: number, tradeMode?: string) {
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'wanted') return 'Busco';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(priceClp)}`;
}

export function ListingDetailV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [favorite, setFavorite] = useState(false);

  const listing = __DEV__
    ? marketPreviewListings.find((item) => item.id === id)
    : undefined;
  const trust = id ? marketSellerTrustPreviewByListing[id] : undefined;

  if (!listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Publicación no disponible</Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Volver a Mercado</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusMeta = marketListingStatusMeta[listing.status];
  const contactEnabled = canContactMarketSeller(listing.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={styles.circleButton}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            onPress={() => setFavorite((value) => !value)}
            style={styles.circleButton}
          >
            <Text style={[styles.iconText, favorite && styles.favoriteActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Más opciones"
            onPress={() =>
              Alert.alert('Publicación', undefined, [
                { text: 'Ocultar publicación' },
                { text: 'Reportar', style: 'destructive' },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
            style={styles.circleButton}
          >
            <Text style={styles.iconText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: listing.imageUrl }} style={styles.heroImage} />

        <View style={styles.content}>
          <Pressable style={styles.sellerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{listing.sellerName.slice(0, 1)}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.sellerName}</Text>
              <Text style={styles.sellerMeta}>{listing.comuna}</Text>
              {trust ? (
                <Text style={styles.sellerSubmeta}>{trust.joinedLabel}</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {trust ? (
            <View style={styles.trustGrid}>
              <View style={styles.trustItem}>
                <Text style={styles.trustValue}>{trust.completedTrades}</Text>
                <Text style={styles.trustLabel}>intercambios completados</Text>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItemWide}>
                <Text style={styles.trustValueSmall}>{trust.responseLabel}</Text>
                <Text style={styles.trustLabel}>
                  {trust.neighborhoodVerified ? 'Barrio verificado' : 'Perfil local'}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <View
              style={[
                styles.statusPill,
                listing.status === 'reserved' && styles.statusPillReserved,
              ]}
            >
              <Text style={styles.statusText}>{statusMeta.label}</Text>
            </View>
          </View>

          <Text style={styles.meta}>
            {listing.comuna} · {listing.distanceKm.toFixed(1).replace('.', ',')} km · {listing.ageLabel}
          </Text>

          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.activityRow}>
            <Text style={styles.activityText}>
              {favorite ? '♥' : '♡'} {listing.favorites + (favorite ? 1 : 0)} interesados
            </Text>
            <Text style={styles.activityText}>{listing.chats} chats</Text>
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
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          onPress={() => setFavorite((value) => !value)}
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
            {formatPrice(listing.priceClp, listing.tradeMode)}
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
  titleRow: { gap: 10 },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statusPill: {
    alignSelf: 'flex-start',
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
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
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
