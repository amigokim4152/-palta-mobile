import { router, useLocalSearchParams } from 'expo-router';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { marketPreviewListings } from './marketPreviewData';

function formatPrice(priceClp?: number, tradeMode?: string) {
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'wanted') return 'Busco';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(priceClp)}`;
}

export function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = __DEV__
    ? marketPreviewListings.find((item) => item.id === id)
    : undefined;

  if (!listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Publicación no disponible</Text>
          <Pressable onPress={() => router.back()} style={styles.backToMarketButton}>
            <Text style={styles.backToMarketText}>Volver a Mercado</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerOverlay}>
        <Pressable onPress={() => router.back()} style={styles.circleButton}>
          <Text style={styles.circleButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.circleButton}>
            <Text style={styles.smallIcon}>♡</Text>
          </Pressable>
          <Pressable style={styles.circleButton}>
            <Text style={styles.smallIcon}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: listing.imageUrl }} style={styles.heroImage} />

        <View style={styles.content}>
          <View style={styles.sellerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{listing.sellerName.slice(0, 1)}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.sellerName}</Text>
              <Text style={styles.sellerMeta}>{listing.comuna} · vecino de la zona</Text>
            </View>
            <View style={styles.trustPill}>
              <Text style={styles.trustPillText}>Perfil local</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.meta}>
            {listing.comuna} · {listing.distanceKm.toFixed(1).replace('.', ',')} km · {listing.ageLabel}
          </Text>

          {listing.status === 'reserved' ? (
            <View style={styles.reservedPill}>
              <Text style={styles.reservedText}>Reservado</Text>
            </View>
          ) : null}

          <Text style={styles.description}>{listing.description}</Text>

          <View style={styles.activityRow}>
            <Text style={styles.activityText}>♡ {listing.favorites} interesados</Text>
            <Text style={styles.activityText}>{listing.chats} chats</Text>
          </View>

          <View style={styles.safetyBox}>
            <Text style={styles.safetyTitle}>Intercambia con calma</Text>
            <Text style={styles.safetyBody}>
              Coordina el punto de encuentro por mensaje y evita publicar tu dirección exacta.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.favoriteButton}>
          <Text style={styles.favoriteText}>♡</Text>
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
        <Pressable style={styles.chatButton}>
          <Text style={styles.chatButtonText}>Mensaje</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: paltaTheme.color.canvas,
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
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  circleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  circleButtonText: {
    color: paltaTheme.color.textPrimary,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -2,
  },
  smallIcon: {
    color: paltaTheme.color.textPrimary,
    fontSize: 22,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1.08,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: paltaTheme.color.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  sellerInfo: {
    flex: 1,
    marginLeft: 11,
  },
  sellerName: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  sellerMeta: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 12,
  },
  trustPill: {
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: paltaTheme.radius.pill,
  },
  trustPillText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paltaTheme.color.divider,
    marginVertical: 18,
  },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 7,
    color: paltaTheme.color.textMuted,
    fontSize: 13,
  },
  reservedPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reservedText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    marginTop: 20,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 23,
  },
  activityRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 14,
  },
  activityText: {
    color: paltaTheme.color.textMuted,
    fontSize: 12,
  },
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
  favoriteText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 25,
  },
  priceBlock: {
    flex: 1,
  },
  price: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  freePrice: {
    color: paltaTheme.color.brandPrimary,
  },
  priceHint: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  chatButton: {
    minWidth: 112,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
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
  backToMarketButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToMarketText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
