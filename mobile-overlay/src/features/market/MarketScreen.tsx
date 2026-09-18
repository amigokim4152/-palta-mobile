import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DiscoverMarketListingsQuery } from '../../../../src/market/marketApiContract';
import {
  marketCategories,
  type MarketCategoryKey,
} from '../../../../src/market/marketCatalog';
import { marketListingStatusMeta } from '../../../../src/market/marketLifecycle';
import type { MarketPublicListing } from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

type RuntimeCompatibleVertical =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'local_produce';

type ExtendedDiscoverMarketListingsQuery = DiscoverMarketListingsQuery & {
  vertical?: RuntimeCompatibleVertical;
};

const MARKET_VERTICAL_ENTRIES: Array<{
  key: RuntimeCompatibleVertical;
  title: string;
  description: string;
}> = [
  {
    key: 'vehicles',
    title: 'Autos',
    description: 'Compra, venta y gestión de vehículos',
  },
  {
    key: 'property',
    title: 'Propiedades',
    description: 'Venta, arriendo y búsqueda por mapa',
  },
  {
    key: 'secondhand',
    title: 'Usados',
    description: 'Artículos de personas cerca de ti',
  },
  {
    key: 'local_produce',
    title: 'Productos locales',
    description: 'Venta directa de tu zona',
  },
];

function openMarketVertical(key: RuntimeCompatibleVertical) {
  if (key === 'vehicles') {
    router.push('/autos?source=mercado');
    return;
  }
  if (key === 'property') {
    router.push('/propiedades?source=mercado');
    return;
  }
  router.push(`/market/${key}`);
}

function formatPrice(listing: MarketPublicListing) {
  if (listing.tradeMode === 'free') return 'Gratis';
  if (listing.tradeMode === 'wanted') return 'Busco';
  if (listing.tradeMode === 'exchange') return 'Intercambio';
  if (typeof listing.priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(listing.priceClp)}`;
}

function formatAge(listing: MarketPublicListing) {
  const source = listing.publishedAt ?? listing.createdAt;
  const time = Date.parse(source);
  if (!Number.isFinite(time)) return 'hace poco';
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function ListingRow({
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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/market/listing/${listing.id}`)}
      style={({ pressed }) => [styles.listingRow, pressed && styles.pressed]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.listingImage} />
      ) : (
        <View style={[styles.listingImage, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>Sin foto</Text>
        </View>
      )}
      <View style={styles.listingBody}>
        <Text numberOfLines={2} style={styles.listingTitle}>
          {listing.title}
        </Text>
        <Text style={styles.listingMeta}>
          {listing.location.comunaName}
          {typeof listing.distanceKm === 'number'
            ? ` · ${listing.distanceKm.toFixed(1).replace('.', ',')} km`
            : ''}
          {' · '}
          {formatAge(listing)}
        </Text>
        <View style={styles.priceLine}>
          <Text
            style={[
              styles.price,
              listing.tradeMode === 'free' && styles.freePrice,
            ]}
          >
            {formatPrice(listing)}
          </Text>
          {listing.status !== 'active' ? (
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>
                {marketListingStatusMeta[listing.status].label}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.engagementLine}>
          <Text style={styles.engagement}>♡ {listing.favoriteCount}</Text>
          {typeof listing.chatCount === 'number' ? (
            <Text style={styles.engagement}>Chats {listing.chatCount}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function MarketScreen() {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [category, setCategory] = useState<MarketCategoryKey>('all');
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<MarketPublicListing[]>([]);
  const [loading, setLoading] = useState(Boolean(runtime.read));
  const [loadError, setLoadError] = useState<string | undefined>(
    runtime.read ? undefined : 'Mercado no está disponible en este momento.',
  );
  const areaLabel =
    runtime.publicArea?.comunaName ??
    (runtime.mode === 'development_preview' ? 'Vitacura' : 'Tu zona');

  useEffect(() => {
    if (!runtime.read) return;
    let active = true;
    const normalizedQuery = query.trim();
    const request: ExtendedDiscoverMarketListingsQuery = {
      vertical: 'secondhand',
      sort: 'recent',
      limit: 30,
      ...(category !== 'all' ? { category } : {}),
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
    };

    setLoading(true);
    setLoadError(undefined);
    runtime.read
      .discover(request as DiscoverMarketListingsQuery)
      .then((page) => {
        if (active) setListings(page.items);
      })
      .catch(() => {
        if (!active) return;
        setListings([]);
        setLoadError('No pudimos cargar Mercado. Intenta nuevamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, query, runtime]);

  const header = (
    <View>
      <View style={styles.topBar}>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Mercado</Text>
          <Text style={styles.locationText}>{areaLabel} · cerca de ti</Text>
        </View>
        {runtime.mode === 'development_preview' ? (
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Vista previa</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.activityActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/market/transactions')}
          style={styles.activityButton}
        >
          <Text style={styles.activityButtonTitle}>Mis compras</Text>
          <Text style={styles.activityButtonSub}>Acuerdos y seguimiento</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/market/my-listings')}
          style={styles.activityButton}
        >
          <Text style={styles.activityButtonTitle}>Mis ventas</Text>
          <Text style={styles.activityButtonSub}>Reservas y entregas</Text>
        </Pressable>
      </View>

      <Text style={styles.verticalIntro}>¿Qué estás buscando?</Text>
      <FlatList
        horizontal
        data={MARKET_VERTICAL_ENTRIES}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.verticalRow}
        renderItem={({ item }) => {
          const selected = item.key === 'secondhand';
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => openMarketVertical(item.key)}
              style={({ pressed }) => [
                styles.verticalCard,
                selected && styles.verticalCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.verticalTitle,
                  selected && styles.verticalTitleSelected,
                ]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.verticalDescription,
                  selected && styles.verticalDescriptionSelected,
                ]}
              >
                {item.description}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar artículos usados"
          placeholderTextColor={paltaTheme.color.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <FlatList
        horizontal
        data={marketCategories}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
        renderItem={({ item }) => {
          const selected = category === item.key;
          return (
            <Pressable
              onPress={() => setCategory(item.key)}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selected && styles.categoryChipTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.sectionLine}>
        <Text style={styles.sectionTitle}>Usados cerca de ti</Text>
        <Pressable onPress={() => router.push('/market/secondhand')}>
          <Text style={styles.viewMoreText}>Ver y comparar</Text>
        </Pressable>
      </View>
    </View>
  );

  const empty = loading ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Cargando publicaciones…</Text>
    </View>
  ) : loadError ? (
    <View style={styles.integrationState}>
      <Text style={styles.emptyTitle}>Mercado no está disponible</Text>
      <Text style={styles.emptyBody}>{loadError}</Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Todavía no hay publicaciones aquí</Text>
      <Text style={styles.emptyBody}>
        Cambia la categoría o publica el primer artículo de tu zona.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListingRow
            listing={item}
            resolveMediaAssetUrl={runtime.resolveMediaAssetUrl}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vender en Mercado"
        onPress={() => router.push('/market/sell')}
        style={({ pressed }) => [styles.sellButton, pressed && styles.pressed]}
      >
        <Text style={styles.sellPlus}>＋</Text>
        <Text style={styles.sellText}>Vender</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 104 },
  topBar: {
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  headingBlock: { flex: 1 },
  heading: {
    color: paltaTheme.color.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  locationText: {
    marginTop: 3,
    color: paltaTheme.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  previewBadge: {
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewBadgeText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  activityActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 9,
  },
  activityButton: {
    flex: 1,
    minHeight: 61,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  activityButtonTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  activityButtonSub: {
    marginTop: 4,
    color: paltaTheme.color.textMuted,
    fontSize: 10,
  },
  verticalIntro: {
    marginTop: 18,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  verticalRow: { paddingTop: 9, paddingBottom: 2, gap: 9 },
  verticalCard: {
    width: 142,
    minHeight: 82,
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  verticalCardSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  verticalTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  verticalTitleSelected: { color: paltaTheme.color.brandPrimary },
  verticalDescription: {
    marginTop: 5,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  verticalDescriptionSelected: { color: paltaTheme.color.textSecondary },
  searchBox: {
    marginTop: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: paltaTheme.radius.prominent,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 14,
  },
  searchGlyph: { color: paltaTheme.color.textMuted, fontSize: 18 },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
  },
  categoryRow: { paddingTop: 12, paddingBottom: 2, gap: 7 },
  categoryChip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 12,
  },
  categoryChipSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  categoryChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextSelected: { color: paltaTheme.color.brandPrimary },
  sectionLine: {
    marginTop: 19,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  viewMoreText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  listingRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  listingImage: {
    width: 104,
    height: 104,
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  listingBody: { flex: 1, minWidth: 0 },
  listingTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  listingMeta: {
    marginTop: 4,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  priceLine: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  price: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  freePrice: { color: paltaTheme.color.brandPrimary },
  statusChip: {
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 9,
    fontWeight: '800',
  },
  engagementLine: {
    marginTop: 'auto',
    paddingTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  engagement: { color: paltaTheme.color.textMuted, fontSize: 10 },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  integrationState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
  },
  emptyTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 7,
    color: paltaTheme.color.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  sellButton: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 17,
    borderRadius: 25,
    backgroundColor: paltaTheme.color.brandPrimary,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sellPlus: { color: '#FFFFFF', fontSize: 20, fontWeight: '500' },
  sellText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
