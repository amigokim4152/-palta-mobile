import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { PropertyListingCard } from './PropertyListingCard';
import { PROPERTY_DEMO_LISTINGS } from './propertyDemoData';
import { useSavedRealEstateListings } from './useSavedRealEstateListings';

export function SavedPropertiesScreen() {
  const { loading, savedIds, isSaved, toggleSaved } = useSavedRealEstateListings();
  const listings = PROPERTY_DEMO_LISTINGS.filter((item) => savedIds.has(item.listing.id));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        contentContainerStyle={{
          padding: paltaTheme.spacing.md,
          paddingBottom: 48,
          gap: paltaTheme.spacing.lg,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Guardados
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            Propiedades que quieres revisar de nuevo. Se guardan localmente y después podrán sincronizarse con tu cuenta Palta.
          </Text>
        </View>

        {loading ? (
          <View
            style={{
              padding: paltaTheme.spacing.lg,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
            }}
          >
            <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando guardados…</Text>
          </View>
        ) : listings.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            {listings.map((item) => (
              <PropertyListingCard
                key={item.listing.id}
                item={item}
                saved={isSaved(item.listing.id)}
                onToggleSaved={() => void toggleSaved(item.listing.id)}
                onPress={() => router.push(`/propiedades/listing/${encodeURIComponent(item.listing.id)}`)}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              padding: paltaTheme.spacing.xl,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              gap: paltaTheme.spacing.sm,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              Aún no guardas propiedades
            </Text>
            <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
              Guarda una propiedad desde la lista o el mapa para compararla después.
            </Text>
            <PaltaButton label="Explorar propiedades" onPress={() => router.replace('/propiedades')} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
