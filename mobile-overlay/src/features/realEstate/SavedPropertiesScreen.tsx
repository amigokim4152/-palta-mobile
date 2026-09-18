import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { buildRealEstateQueryString } from '../../../../src/realEstate/realEstateQueryParams';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { PropertyListingCard } from './PropertyListingCard';
import { useSavedRealEstateListingItems } from './useSavedRealEstateListingItems';
import { useSavedRealEstateListings } from './useSavedRealEstateListings';
import { useSavedRealEstateSearches } from './useSavedRealEstateSearches';

export function SavedPropertiesScreen() {
  const savedListings = useSavedRealEstateListings();
  const savedSearches = useSavedRealEstateSearches();
  const savedListingItems = useSavedRealEstateListingItems(savedListings.savedIds);

  function openSearch(queryString: string) {
    router.push(queryString ? `/propiedades?${queryString}` : '/propiedades');
  }

  const listingsLoading = savedListings.loading || savedListingItems.loading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        contentContainerStyle={{
          padding: paltaTheme.spacing.md,
          paddingBottom: 48,
          gap: paltaTheme.spacing.xl,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Guardados
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            Propiedades y búsquedas que quieres volver a revisar. El estado local queda preparado para sincronizarse después con tu cuenta Palta.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Propiedades guardadas
          </Text>

          {listingsLoading ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando guardados…</Text>
          ) : savedListingItems.error ? (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              }}
            >
              <Text style={{ color: paltaTheme.color.textSecondary }}>{savedListingItems.error}</Text>
            </View>
          ) : savedListingItems.items.length ? (
            savedListingItems.items.map((item) => (
              <PropertyListingCard
                key={item.listing.id}
                item={item}
                saved={savedListings.isSaved(item.listing.id)}
                onToggleSaved={() => void savedListings.toggleSaved(item.listing.id)}
                onPress={() => router.push(`/propiedades/listing/${encodeURIComponent(item.listing.id)}`)}
              />
            ))
          ) : (
            <View
              style={{
                padding: paltaTheme.spacing.lg,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
                gap: paltaTheme.spacing.sm,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
                Aún no guardas propiedades
              </Text>
              <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                Guarda una propiedad desde la lista o el mapa para compararla después.
              </Text>
              <PaltaButton label="Explorar propiedades" onPress={() => router.replace('/propiedades')} />
            </View>
          )}
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Búsquedas guardadas
          </Text>

          {savedSearches.loading ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando búsquedas…</Text>
          ) : savedSearches.searches.length ? (
            savedSearches.searches.map((search) => (
              <View
                key={search.id}
                style={{
                  padding: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.surface,
                  backgroundColor: paltaTheme.color.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.divider,
                  gap: paltaTheme.spacing.sm,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
                    {search.label}
                  </Text>
                  <Text style={{ fontSize: 12, lineHeight: 17, color: paltaTheme.color.textMuted }}>
                    {search.alertEnabled
                      ? 'Quieres recibir avisos. La suscripción real se activará cuando Event Core sincronice esta búsqueda.'
                      : 'Sin avisos. Puedes dejar preparada tu preferencia sin activar una notificación falsa.'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
                  <PaltaButton
                    label="Abrir"
                    style={{ flex: 1 }}
                    onPress={() => openSearch(buildRealEstateQueryString(search.query))}
                  />
                  <PaltaButton
                    label="Eliminar"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => void savedSearches.remove(search.id)}
                  />
                </View>
                <PaltaButton
                  label={search.alertEnabled ? 'No avisarme' : 'Avisarme de nuevas propiedades'}
                  variant="secondary"
                  onPress={() => void savedSearches.setAlertPreference(search.id, !search.alertEnabled)}
                />
              </View>
            ))
          ) : (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              }}
            >
              <Text style={{ color: paltaTheme.color.textSecondary }}>
                Cuando guardes una combinación de zona y filtros aparecerá aquí.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
