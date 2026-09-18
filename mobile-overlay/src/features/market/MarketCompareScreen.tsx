import { router, useLocalSearchParams } from 'expo-router';
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
import { marketListingStatusMeta } from '../../../../src/market/marketLifecycle';
import type { MarketPublicListing } from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';
import type { MarketRouteVertical } from './MarketVerticalBrowseScreen';

const MAX_COMPARE_ITEMS = 4;

const VERTICAL_TITLES: Record<MarketRouteVertical, string> = {
  secondhand: 'Usados',
  vehicles: 'Vehículos',
  property: 'Propiedades',
  local_produce: 'Productos locales',
};

function routeVertical(value: string | undefined): MarketRouteVertical | undefined {
  if (!value || !(value in VERTICAL_TITLES)) return undefined;
  return value as MarketRouteVertical;
}

function formatPrice(listing: MarketPublicListing) {
  const tradeMode = String(listing.tradeMode);
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'wanted') return 'Busco';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof listing.priceClp !== 'number') return 'A convenir';
  const value = `$${new Intl.NumberFormat('es-CL').format(listing.priceClp)}`;
  return tradeMode === 'rent' ? `${value} / mes` : value;
}

function CompareCard({
  listing,
  resolveMediaAssetUrl,
}: {
  listing: MarketPublicListing;
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
}) {
  const firstMedia = listing.media[0];
  const imageUrl = firstMedia
    ? resolveMediaAssetUrl(firstMedia.mediaAssetId)
    : undefined;
  const status = marketListingStatusMeta[listing.status];

  return (
    <View style={styles.compareCard}>
      <Pressable
        onPress={() => router.push(`/market/listing/${listing.id}`)}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>Sin foto</Text>
          </View>
        )}
        <Text numberOfLines={2} style={styles.title}>
          {listing.title}
        </Text>
      </Pressable>

      <View style={styles.metricBlock}>
        <Text style={styles.metricLabel}>Precio</Text>
        <Text style={styles.price}>{formatPrice(listing)}</Text>
      </View>

      <View style={styles.metricBlock}>
        <Text style={styles.metricLabel}>Zona</Text>
        <Text style={styles.metricValue}>
          {listing.location.comunaName}
          {typeof listing.distanceKm === 'number'
            ? ` · ${listing.distanceKm.toFixed(1).replace('.', ',')} km`
            : ''}
        </Text>
      </View>

      <View style={styles.metricBlock}>
        <Text style={styles.metricLabel}>Vendedor</Text>
        <Text style={styles.metricValue}>{listing.seller.displayName}</Text>
        <Text style={styles.metricSubvalue}>
          {listing.seller.neighborhoodVerified
            ? 'Barrio verificado'
            : 'Perfil local'}
          {listing.seller.completedTrades > 0
            ? ` · ${listing.seller.completedTrades} intercambios`
            : ''}
        </Text>
      </View>

      <View style={styles.metricBlock}>
        <Text style={styles.metricLabel}>Estado</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push(`/market/listing/${listing.id}`)}
        style={styles.detailButton}
      >
        <Text style={styles.detailButtonText}>Ver publicación</Text>
      </Pressable>
    </View>
  );
}

export function MarketCompareScreen() {
  const { vertical, ids } = useLocalSearchParams<{
    vertical?: string;
    ids?: string;
  }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const resolvedVertical = routeVertical(vertical);
  const listingIds = useMemo(
    () =>
      Array.from(
        new Set(
          (ids ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).slice(0, MAX_COMPARE_ITEMS),
    [ids],
  );
  const [listings, setListings] = useState<MarketPublicListing[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!runtime.read || listingIds.length < 2 || !resolvedVertical) {
      setListings([]);
      return;
    }
    let active = true;
    setError(undefined);
    Promise.all(listingIds.map((id) => runtime.read!.getPublicListing(id)))
      .then((items) => {
        if (!active) return;
        setListings(items.filter((item): item is MarketPublicListing => Boolean(item)));
      })
      .catch(() => {
        if (!active) return;
        setListings([]);
        setError('No pudimos cargar todas las publicaciones seleccionadas.');
      });
    return () => {
      active = false;
    };
  }, [listingIds, resolvedVertical, runtime]);

  const title = resolvedVertical ? VERTICAL_TITLES[resolvedVertical] : 'Mercado';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Comparar</Text>
          <Text style={styles.subtitle}>{title}</Text>
        </View>
      </View>

      {listings === undefined ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Cargando comparación…</Text>
        </View>
      ) : listings.length < 2 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Selecciona al menos dos publicaciones</Text>
          <Text style={styles.stateBody}>
            {error ?? 'Vuelve a la lista y agrega publicaciones para compararlas.'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compareRow}
        >
          {listings.map((listing) => (
            <CompareCard
              key={listing.id}
              listing={listing}
              resolveMediaAssetUrl={runtime.resolveMediaAssetUrl}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          La comparación usa datos públicos de la publicación. Palta no muestra la dirección exacta ni datos privados del vendedor.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: paltaTheme.color.textPrimary,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  headerCopy: { flex: 1 },
  heading: {
    color: paltaTheme.color.textPrimary,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
  },
  compareRow: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 112,
    gap: 12,
  },
  compareCard: {
    width: 254,
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    padding: 12,
  },
  pressed: { opacity: 0.76 },
  image: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 13,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: paltaTheme.color.textMuted, fontSize: 12 },
  title: {
    marginTop: 11,
    minHeight: 42,
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  metricBlock: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paltaTheme.color.divider,
  },
  metricLabel: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  price: {
    marginTop: 4,
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  metricValue: {
    marginTop: 4,
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  metricSubvalue: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailButton: {
    marginTop: 18,
    minHeight: 42,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
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
  primaryButton: {
    marginTop: 18,
    minHeight: 42,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  privacyNote: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  privacyText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
