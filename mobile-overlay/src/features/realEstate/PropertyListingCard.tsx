import { Pressable, Text, View } from 'react-native';
import {
  formatListingPrice,
  formatPropertyFacts,
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_PUBLISHER_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import { paltaTheme } from '../../theme/paltaTheme';
import type { PropertyListingPreview } from './propertyDemoData';

export function PropertyListingCard({
  item,
  compact = false,
  selected = false,
  onPress,
}: {
  item: PropertyListingPreview;
  compact?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { listing, property } = item;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: compact ? 'column' : 'row',
        gap: paltaTheme.spacing.sm,
        padding: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
      })}
    >
      <View
        style={{
          width: compact ? '100%' : 118,
          height: compact ? 116 : 108,
          borderRadius: paltaTheme.radius.control,
          backgroundColor: paltaTheme.color.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
          {REAL_ESTATE_PROPERTY_TYPE_LABELS[property.type]}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 11, color: paltaTheme.color.textMuted }}>
          Foto
        </Text>
        {item.featured ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              Destacado
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 6 }}>
        <View style={{ gap: 3 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            {formatListingPrice(listing)}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: paltaTheme.color.textPrimary }}>
            {item.sector} · {item.comuna}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>
            {formatPropertyFacts(property)}
          </Text>
        </View>

        <View style={{ gap: 3 }}>
          {listing.commonExpensesClp !== undefined ? (
            <Text numberOfLines={1} style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
              Gastos comunes ${new Intl.NumberFormat('es-CL').format(listing.commonExpensesClp)}
            </Text>
          ) : null}
          <Text numberOfLines={1} style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
            {REAL_ESTATE_PUBLISHER_LABELS[item.publisherType]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
