import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import type { MarketPublicListing } from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

export type MarketRouteVertical =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'local_produce';

type MarketSort = 'recent' | 'distance' | 'price_asc' | 'price_desc';
type PropertyOperation = 'all' | 'sale' | 'rent';

type ExtendedDiscoverMarketListingsQuery = Omit<
  DiscoverMarketListingsQuery,
  'tradeMode'
> & {
  vertical?: MarketRouteVertical;
  maxDistanceKm?: number;
  surface?: 'list' | 'map';
  tradeMode?: DiscoverMarketListingsQuery['tradeMode'] | 'rent';
};

type VerticalUiDefinition = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  createLabel: string;
  mapUseful: boolean;
  comparisonUseful: boolean;
};

const VERTICAL_UI: Record<MarketRouteVertical, VerticalUiDefinition> = {
  secondhand: {
    title: 'Usados',
    subtitle: 'Compra, vende o regala cerca de ti.',
    searchPlaceholder: 'Buscar artículos usados',
    createLabel: 'Publicar artículo',
    mapUseful: false,
    comparisonUseful: true,
  },
  vehicles: {
    title: 'Vehículos',
    subtitle: 'Autos y otros vehículos publicados en tu zona.',
    searchPlaceholder: 'Marca, modelo o palabra clave',
    createLabel: 'Publicar vehículo',
    mapUseful: true,
    comparisonUseful: true,
  },
  property: {
    title: 'Propiedades',
    subtitle: 'Venta y arriendo con contexto local y distancia.',
    searchPlaceholder: 'Comuna, sector o característica',
    createLabel: 'Publicar propiedad',
    mapUseful: true,
    comparisonUseful: true,
  },
  local_produce: {
    title: 'Productos locales',
    subtitle: 'Producción y venta directa de tu zona.',
    searchPlaceholder: 'Buscar productos locales',
    createLabel: 'Publicar producto',
    mapUseful: true,
    comparisonUseful: false,
  },
};

const DISTANCES: Array<{ label: string; value?: number }> = [
  { label: 'Todo' },
  { label: '2 km', value: 2 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
];

const SORTS: Array<{ label: string; value: MarketSort }> = [
  { label: 'Recientes', value: 'recent' },
  { label: 'Más cerca', value: 'distance' },
  { label: 'Menor precio', value: 'price_asc' },
  { label: 'Mayor precio', value: 'price_desc' },
];

// Mirrors the canonical Mercado comparison contract while the reviewed runtime
// baseline still carries an older src/market snapshot. Selection stores ids only.
const MAX_COMPARE_ITEMS = 4;

function tradeModeOf(listing: MarketPublicListing): string {
  return String(listing.tradeMode);
}

function formatPrice(listing: MarketPublicListing): string {
  const tradeMode = tradeModeOf(listing);
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'wanted') return 'Busco';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof listing.priceClp !== 'number') return 'A convenir';
  const formatted = `$${new Intl.NumberFormat('es-CL').format(listing.priceClp)}`;
  return tradeMode === 'rent' ? `${formatted} / mes` : formatted;
}

function operationLabel(vertical: MarketRouteVertical, listing: MarketPublicListing) {
  if (vertical === 'property') {
    return tradeModeOf(listing) === 'rent' ? 'Arriendo' : 'Venta';
  }
  if (vertical === 'vehicles') return 'Vehículo';
  if (vertical === 'local_produce') return 'Local';
  return undefined;
}

function VerticalListingCard({
  vertical,
  listing,
  resolveMediaAssetUrl,
  comparisonEnabled,
  selectedForCompare,
  onToggleCompare,
}: {
  vertical: MarketRouteVertical;
  listing: MarketPublicListing;
  resolveMediaAssetUrl: (mediaAssetId: string) => string | undefined;
  comparisonEnabled: boolean;
  selectedForCompare: boolean;
  onToggleCompare: () => void;
}) {
  const firstMedia = listing.media[0];
  const imageUrl = firstMedia
    ? resolveMediaAssetUrl(firstMedia.mediaAssetId)
    : undefined;
  const label = operationLabel(vertical, listing);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/market/listing/${listing.id}`)}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>Sin foto</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardTitleLine}>
            <Text numberOfLines={2} style={styles.cardTitle}>
              {listing.title}
            </Text>
            {label ? (
              <View style={styles.verticalBadge}>
                <Text style={styles.verticalBadgeText}>{label}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardMeta}>
            {listing.location.comunaName}
            {typeof listing.distanceKm === 'number'
              ? ` · ${listing.distanceKm.toFixed(1).replace('.', ',')} km`
              : ''}
          </Text>
          <Text style={styles.price}>{formatPrice(listing)}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.sellerText}>{listing.seller.displayName}</Text>
            <Text style={styles.interestText}>♡ {listing.favoriteCount}</Text>
          </View>
        </View>
      </Pressable>

      {comparisonEnabled ? (
        <View style={styles.cardActionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedForCompare }}
            onPress={onToggleCompare}
            style={[
              styles.compareChip,
              selectedForCompare && styles.compareChipSelected,
            ]}
          >
            <Text
              style={[
                styles.compareChipText,
                selectedForCompare && styles.compareChipTextSelected,
              ]}
            >
              {selectedForCompare ? '✓ En comparación' : '＋ Comparar'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function MarketVerticalBrowseScreen({
  vertical,
}: {
  vertical: MarketRouteVertical;
}) {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const definition = VERTICAL_UI[vertical];
  const [query, setQuery] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | undefined>(
    definition.mapUseful ? 10 : undefined,
  );
  const [sort, setSort] = useState<MarketSort>('recent');
  const [propertyOperation, setPropertyOperation] = useState<PropertyOperation>('all');
  const [listings, setListings] = useState<MarketPublicListing[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(runtime.read));
  const [error, setError] = useState<string | undefined>(
    runtime.read ? undefined : 'Mercado no está disponible en este momento.',
  );

  useEffect(() => {
    if (!runtime.read) return;
    let active = true;
    const normalizedQuery = query.trim();
    const request: ExtendedDiscoverMarketListingsQuery = {
      vertical,
      surface: 'list',
      sort,
      limit: 40,
      ...(distanceKm !== undefined ? { maxDistanceKm: distanceKm } : {}),
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
      ...(vertical === 'property' && propertyOperation !== 'all'
        ? { tradeMode: propertyOperation }
        : {}),
    };

    setLoading(true);
    setError(undefined);
    runtime.read
      .discover(request as unknown as DiscoverMarketListingsQuery)
      .then((page) => {
        if (active) setListings(page.items);
      })
      .catch(() => {
        if (!active) return;
        setListings([]);
        setError('No pudimos cargar estas publicaciones. Intenta nuevamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [distanceKm, propertyOperation, query, runtime, sort, vertical]);

  function toggleCompare(listingId: string) {
    setCompareIds((current) => {
      if (current.includes(listingId)) {
        return current.filter((id) => id !== listingId);
      }
      if (current.length >= MAX_COMPARE_ITEMS) {
        Alert.alert(
          'Comparar publicaciones',
          `Puedes comparar hasta ${MAX_COMPARE_ITEMS} publicaciones a la vez.`,
        );
        return current;
      }
      return [...current, listingId];
    });
  }

  function openComparison() {
    if (compareIds.length < 2) return;
    router.push({
      pathname: '/market/compare',
      params: { vertical, ids: compareIds.join(',') },
    });
  }

  const header = (
    <View>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a Mercado"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>{definition.title}</Text>
          <Text style={styles.subtitle}>{definition.subtitle}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={definition.searchPlaceholder}
          placeholderTextColor={paltaTheme.color.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      {vertical === 'property' ? (
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Operación</Text>
          <View style={styles.filterWrap}>
            {([
              ['all', 'Todo'],
              ['sale', 'Venta'],
              ['rent', 'Arriendo'],
            ] as const).map(([value, label]) => {
              const selected = propertyOperation === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setPropertyOperation(value)}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Distancia</Text>
        <FlatList
          horizontal
          data={DISTANCES}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalFilters}
          renderItem={({ item }) => {
            const selected = distanceKm === item.value;
            return (
              <Pressable
                onPress={() => setDistanceKm(item.value)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Ordenar</Text>
        <FlatList
          horizontal
          data={SORTS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalFilters}
          renderItem={({ item }) => {
            const selected = sort === item.value;
            return (
              <Pressable
                onPress={() => setSort(item.value)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selected && styles.filterChipTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.resultsLine}>
        <Text style={styles.resultsTitle}>Publicaciones</Text>
        <Text style={styles.resultsCount}>{loading ? '…' : listings.length}</Text>
      </View>
    </View>
  );

  const empty = loading ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Cargando publicaciones…</Text>
    </View>
  ) : error ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No pudimos cargar esta sección</Text>
      <Text style={styles.emptyBody}>{error}</Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No hay resultados con estos filtros</Text>
      <Text style={styles.emptyBody}>
        Amplía la distancia o cambia la búsqueda. Mercado no mostrará una ubicación exacta del vendedor.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VerticalListingCard
            vertical={vertical}
            listing={item}
            resolveMediaAssetUrl={runtime.resolveMediaAssetUrl}
            comparisonEnabled={definition.comparisonUseful}
            selectedForCompare={compareIds.includes(item.id)}
            onToggleCompare={() => toggleCompare(item.id)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />

      {definition.comparisonUseful && compareIds.length > 0 ? (
        <View style={styles.compareTray}>
          <View style={styles.compareTrayCopy}>
            <Text style={styles.compareTrayTitle}>
              {compareIds.length} {compareIds.length === 1 ? 'seleccionado' : 'seleccionados'}
            </Text>
            <Text style={styles.compareTrayHint}>
              {compareIds.length < 2
                ? 'Selecciona una publicación más.'
                : `Compara hasta ${MAX_COMPARE_ITEMS} lado a lado.`}
            </Text>
          </View>
          <Pressable
            disabled={compareIds.length < 2}
            onPress={openComparison}
            style={[
              styles.compareTrayButton,
              compareIds.length < 2 && styles.compareTrayButtonDisabled,
            ]}
          >
            <Text style={styles.compareTrayButtonText}>Comparar</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={definition.createLabel}
        onPress={() => router.push(`/market/${vertical}?mode=create`)}
        style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
      >
        <Text style={styles.createPlus}>＋</Text>
        <Text style={styles.createText}>{definition.createLabel}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 176 },
  topBar: {
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
  headingBlock: { flex: 1, paddingTop: 1 },
  heading: {
    color: paltaTheme.color.textPrimary,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  searchBox: {
    marginTop: 18,
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
  filterSection: { marginTop: 17 },
  filterTitle: {
    marginBottom: 8,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalFilters: { gap: 8, paddingRight: 18 },
  filterChip: {
    minHeight: 36,
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  filterChipSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandPrimary,
  },
  filterChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextSelected: { color: '#FFFFFF' },
  resultsLine: {
    marginTop: 24,
    paddingBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  resultsCount: {
    color: paltaTheme.color.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  cardMain: {
    flexDirection: 'row',
    gap: 13,
    paddingTop: 14,
  },
  pressed: { opacity: 0.76 },
  cardImage: {
    width: 112,
    height: 106,
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: {
    color: paltaTheme.color.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: { flex: 1, minHeight: 106 },
  cardTitleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: {
    flex: 1,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  verticalBadge: {
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  verticalBadgeText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  cardMeta: {
    marginTop: 5,
    color: paltaTheme.color.textMuted,
    fontSize: 12,
  },
  price: {
    marginTop: 8,
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  cardFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sellerText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  interestText: { color: paltaTheme.color.textMuted, fontSize: 12 },
  cardActionRow: {
    minHeight: 45,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  compareChip: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    paddingHorizontal: 11,
  },
  compareChipSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  compareChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  compareChipTextSelected: { color: paltaTheme.color.brandPrimary },
  emptyState: {
    paddingVertical: 52,
    paddingHorizontal: 24,
    alignItems: 'center',
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
  compareTray: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 78,
    minHeight: 66,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  compareTrayCopy: { flex: 1, paddingRight: 10 },
  compareTrayTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  compareTrayHint: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  compareTrayButton: {
    minHeight: 40,
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandPrimary,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  compareTrayButtonDisabled: { opacity: 0.4 },
  compareTrayButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  createButton: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: paltaTheme.color.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  createPlus: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  createText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
