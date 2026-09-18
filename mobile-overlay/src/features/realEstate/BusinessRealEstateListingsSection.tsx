import { useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { useRealEstateListings } from './useRealEstateListings';

export function BusinessRealEstateListingsSection({ businessId }: { businessId: string }) {
  const query = useMemo(() => ({ businessId }), [businessId]);
  const { listings, loading, error } = useRealEstateListings(query);

  if (loading || error || listings.length === 0) return null;

  return (
    <View
      style={{
        padding: paltaTheme.spacing.md,
        gap: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Propiedades
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: paltaTheme.color.textMuted }}>
          {listings.length === 1
            ? '1 propiedad activa publicada por este negocio.'
            : `${listings.length} propiedades activas publicadas por este negocio.`}
        </Text>
      </View>
      <PaltaButton
        label={listings.length === 1 ? 'Ver propiedad' : `Ver ${listings.length} propiedades`}
        variant="secondary"
        onPress={() => router.push(
          `/propiedades?source=business_profile&businessId=${encodeURIComponent(businessId)}`,
        )}
      />
    </View>
  );
}
