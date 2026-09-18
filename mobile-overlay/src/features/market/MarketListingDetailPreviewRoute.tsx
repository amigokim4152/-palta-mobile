import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MarketRecommendationReason } from '../../../../src/market/marketRecommendation';
import { paltaTheme } from '../../theme/paltaTheme';
import { ListingDetailRuntimeScreen } from './ListingDetailRuntimeScreen';
import {
  marketPreviewRecommendations,
} from './marketPreviewData';
import { getMarketRuntime } from './marketRuntime';

function formatPrice(priceClp: number | undefined, tradeMode: string) {
  if (tradeMode === 'free') return 'Gratis';
  if (tradeMode === 'exchange') return 'Intercambio';
  if (typeof priceClp !== 'number') return 'A convenir';
  return `$${new Intl.NumberFormat('es-CL').format(priceClp)}`;
}

const REASON_LABELS: Partial<Record<MarketRecommendationReason, string>> = {
  same_product_family: 'Mismo tipo',
  similar_price: 'Precio parecido',
  nearby: 'Cerca de ti',
  same_category: 'Misma categoría',
  available_now: 'Disponible',
};

function recommendationReasonLabel(reasons: MarketRecommendationReason[]) {
  const preferredOrder: MarketRecommendationReason[] = [
    'same_product_family',
    'similar_price',
    'nearby',
    'same_category',
    'available_now',
  ];
  return preferredOrder
    .filter((reason) => reasons.includes(reason))
    .map((reason) => REASON_LABELS[reason])
    .filter((label): label is string => Boolean(label))
    .slice(0, 2)
    .join(' · ');
}

/**
 * Visual-review shell only. Production recommendation retrieval belongs behind
 * the Mercado recommendation/read service; the preview uses the same pure
 * scorer contract so ranking behavior can be validated without paid AI.
 */
export function MarketListingDetailPreviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const related = useMemo(() => {
    if (!id || runtime.mode !== 'development_preview') return [];
    return marketPreviewRecommendations(id, 2);
  }, [id, runtime.mode]);

  return (
    <View style={styles.root}>
      <ListingDetailRuntimeScreen />

      {related.length > 0 ? (
        <View style={styles.rail}>
          <View style={styles.railHeading}>
            <View style={styles.railHeadingCopy}>
              <Text style={styles.railTitle}>Similares para ti</Text>
              <Text style={styles.railHint}>según lo que estás viendo</Text>
            </View>
            <Text style={styles.railCount}>{related.length}</Text>
          </View>
          <View style={styles.items}>
            {related.map(({ listing: item, reasons }) => {
              const reasonLabel = recommendationReasonLabel(reasons);
              return (
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
                    {reasonLabel ? (
                      <Text numberOfLines={1} style={styles.itemReason}>
                        {reasonLabel}
                      </Text>
                    ) : null}
                    <Text numberOfLines={1} style={styles.itemMeta}>
                      {item.comuna} · {item.distanceKm.toFixed(1).replace('.', ',')} km
                    </Text>
                    <View style={styles.itemPriceLine}>
                      <Text style={styles.itemPrice}>
                        {formatPrice(item.priceClp, item.tradeMode)}
                      </Text>
                      {item.status === 'reserved' ? (
                        <Text style={styles.reservedLabel}>Reservado</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  railHeadingCopy: { flex: 1 },
  railTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  railHint: {
    marginTop: 1,
    color: paltaTheme.color.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  railCount: {
    minWidth: 24,
    textAlign: 'center',
    color: paltaTheme.color.brandPrimary,
    fontSize: 10,
    fontWeight: '800',
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
    width: 48,
    height: 54,
    borderRadius: 9,
    backgroundColor: paltaTheme.color.surface,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  itemReason: {
    marginTop: 2,
    color: paltaTheme.color.brandPrimary,
    fontSize: 8,
    fontWeight: '700',
  },
  itemMeta: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 8,
  },
  itemPriceLine: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemPrice: {
    color: paltaTheme.color.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  reservedLabel: {
    color: paltaTheme.color.textMuted,
    fontSize: 7,
    fontWeight: '700',
  },
  pressed: { opacity: 0.72 },
});