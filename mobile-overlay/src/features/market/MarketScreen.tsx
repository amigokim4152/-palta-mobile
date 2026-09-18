import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import {
  marketCategories,
  type MarketCategoryKey,
} from '../../../../src/market/marketCatalog';
import {
  isMarketListingPublic,
  marketListingStatusMeta,
} from '../../../../src/market/marketLifecycle';
import { paltaTheme } from '../../theme/paltaTheme';
import {
  marketPreviewListings,
  type MarketPreviewListing,
} from './marketPreviewData';

function formatPrice(listing: MarketPreviewListing) {
  if (listing.tradeMode === 'free') return 'Gratis';
  if (listing.tradeMode === 'wanted') return 'Busco';
  if (listing.tradeMode === 'exchange') return 'Intercambio';
  if (typeof listing.priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(listing.priceClp)}`;
}

function ListingRow({ listing }: { listing: MarketPreviewListing }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/market/listing/${listing.id}`)}
      style={({ pressed }) => [styles.listingRow, pressed && styles.pressed]}
    >
      <Image source={{ uri: listing.imageUrl }} style={styles.listingImage} />
      <View style={styles.listingBody}>
        <View style={styles.titleLine}>
          <Text numberOfLines={2} style={styles.listingTitle}>
            {listing.title}
          </Text>
        </View>
        <Text style={styles.listingMeta}>
          {listing.comuna} · {listing.distanceKm.toFixed(1).replace('.', ',')} km · {listing.ageLabel}
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
          <Text style={styles.engagement}>♡ {listing.favorites}</Text>
          <Text style={styles.engagement}>Chats {listing.chats}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function MarketScreen() {
  const [category, setCategory] = useState<MarketCategoryKey>('all');
  const [query, setQuery] = useState('');

  const listings = useMemo(() => {
    const base = __DEV__
      ? marketPreviewListings.filter((listing) => isMarketListingPublic(listing.status))
      : [];
    const normalized = query.trim().toLocaleLowerCase('es-CL');

    return base.filter((listing) => {
      const categoryMatches = category === 'all' || listing.category === category;
      const queryMatches =
        !normalized ||
        listing.title.toLocaleLowerCase('es-CL').includes(normalized) ||
        listing.comuna.toLocaleLowerCase('es-CL').includes(normalized);
      return categoryMatches && queryMatches;
    });
  }, [category, query]);

  const header = (
    <View>
      <View style={styles.topBar}>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Mercado</Text>
          <Pressable style={styles.locationButton}>
            <Text style={styles.locationText}>Vitacura · cerca de mí</Text>
            <Text style={styles.locationChevron}>⌄</Text>
          </Pressable>
        </View>
        <View style={styles.topActions}>
          {__DEV__ ? (
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>Vista previa</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mis publicaciones"
            onPress={() => router.push('/market/my-listings')}
            style={styles.myListingsButton}
          >
            <Text style={styles.myListingsButtonText}>Mis ventas</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar en Mercado"
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
        <Text style={styles.sectionTitle}>Cerca de ti</Text>
        <Pressable>
          <Text style={styles.sortText}>Más recientes ⌄</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingRow listing={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Todavía no hay publicaciones aquí</Text>
            <Text style={styles.emptyBody}>
              Cambia la categoría o publica el primer artículo de tu zona.
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vender en Mercado"
        onPress={() => router.push('/market/sell')}
        style={({ pressed }) => [styles.sellButton, pressed && styles.sellButtonPressed]}
      >
        <Text style={styles.sellPlus}>＋</Text>
        <Text style={styles.sellText}>Vender</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: paltaTheme.color.canvas,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 104,
  },
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
  locationButton: {
    minHeight: 32,
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  locationChevron: {
    color: paltaTheme.color.textSecondary,
    fontSize: 16,
  },
  topActions: { alignItems: 'flex-end', gap: 7 },
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
  myListingsButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 12,
  },
  myListingsButtonText: {
    color: paltaTheme.color.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    marginTop: 16,
    height: 48,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
  },
  searchGlyph: {
    color: paltaTheme.color.textSecondary,
    fontSize: 23,
    marginRight: 8,
    marginTop: -2,
  },
  searchInput: {
    flex: 1,
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
  },
  categoryRow: {
    paddingTop: 14,
    paddingBottom: 3,
    gap: 8,
  },
  categoryChip: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 14,
  },
  categoryChipSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandPrimary,
  },
  categoryChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  sectionLine: {
    marginTop: 22,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sortText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  listingRow: {
    minHeight: 146,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  pressed: {
    opacity: 0.72,
  },
  listingImage: {
    width: 118,
    height: 118,
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  listingBody: {
    flex: 1,
    minHeight: 118,
    paddingTop: 1,
  },
  titleLine: {
    minHeight: 43,
  },
  listingTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  listingMeta: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  priceLine: {
    marginTop: 8,
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  price: {
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  freePrice: {
    color: paltaTheme.color.brandPrimary,
  },
  statusChip: {
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  engagementLine: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  engagement: {
    color: paltaTheme.color.textMuted,
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 56,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 8,
    color: paltaTheme.color.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  sellButton: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: paltaTheme.color.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  sellButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  sellPlus: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    marginRight: 4,
  },
  sellText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
