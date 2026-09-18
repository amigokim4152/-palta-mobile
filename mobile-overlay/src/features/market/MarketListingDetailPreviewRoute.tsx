import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { ListingDetailRuntimeScreen } from './ListingDetailRuntimeScreen';
import {
  marketPreviewListings,
  marketPreviewRecommendationIds,
} from './marketPreviewData';
import { getMarketRuntime } from './marketRuntime';

function formatPrice(priceClp: number | undefined, tradeMode: string) {
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(priceClp)}`;
}

/**
 * Visual-review shell only. Production recommendation ranking belongs behind
 * the Mercado read/recommendation contract; preview fixtures let us validate
 * the mobile interaction before that service is live.
 */
export function MarketListingDetailPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const related = useMemo(() => {
    if (!id || runtime.mode !== 'development_preview') return [];
    const ids = new Set(marketPreviewRecommendationIds(id, 2));
    return marketPreviewListings.filter((item) => ids.has(item.id));
  }, [id, runtime.mode]);

  return (
    <View style={styles.root}>
      <ListingDetailRuntimeScreen />

      {related.length > 0 ? (
        <View style={styles.rail}>
          <View style={styles.railHeading}>
            <Text style={styles.railTitle}>Similares para ti</Text>
            <Text style={styles.railHint}>mismo tipo · precio cercano</Text>
          </View>
          <View style={styles.items}>
            {related.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.replace(`/market/listing/${item.id}`)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} />
                <View style={styles.itemBody}>
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.itemMeta}>
                    {item.comuna} · {item.distanceKm.toFixed(1).replace('.', ',')} km
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatPrice(item.priceClp, item.tradeMode)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rail: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 82,
    zIndex: 20,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 9,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  railHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  railTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  railHint: {
    color: paltaTheme.color.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  items: { flexDirection: 'row', gap: 8 },
  item: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 6,
  },
  thumbnail: {
    width: 46,
    height: 46,
    borderRadius: 9,
    backgroundColor: paltaTheme.color.surface,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  itemMeta: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 8,
  },
  itemPrice: {
    marginTop: 3,
    color: paltaTheme.color.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  pressed: { opacity: 0.72 },
});
