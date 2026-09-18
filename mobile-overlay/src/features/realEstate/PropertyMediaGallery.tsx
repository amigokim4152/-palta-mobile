import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { RealEstateListingMedia } from '../../../../src/realEstate/realEstateMedia';
import { paltaTheme } from '../../theme/paltaTheme';

export function PropertyMediaGallery({
  media,
  loading,
  error,
  fallbackLabel,
}: {
  media: RealEstateListingMedia | null;
  loading: boolean;
  error: string | null;
  fallbackLabel: string;
}) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(280, width - paltaTheme.spacing.md * 2);
  const items = media?.items ?? [];

  if (!items.length) {
    return (
      <View
        style={{
          height: 270,
          margin: paltaTheme.spacing.md,
          marginBottom: 0,
          borderRadius: paltaTheme.radius.sheet,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paltaTheme.color.brandSoft,
          paddingHorizontal: paltaTheme.spacing.lg,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
          {fallbackLabel}
        </Text>
        <Text style={{ marginTop: 6, textAlign: 'center', color: paltaTheme.color.textMuted }}>
          {loading
            ? 'Cargando galería…'
            : error
              ? 'No pudimos actualizar la galería.'
              : 'Aún no hay imágenes publicadas.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: paltaTheme.spacing.md }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageWidth}
        contentContainerStyle={{ paddingHorizontal: paltaTheme.spacing.md }}
      >
        {items.map((item, index) => (
          <View
            key={item.mediaAssetId}
            style={{
              width: pageWidth,
              height: 270,
              borderRadius: paltaTheme.radius.sheet,
              overflow: 'hidden',
              backgroundColor: paltaTheme.color.brandSoft,
            }}
          >
            {item.deliveryUrl ? (
              <Image
                source={{ uri: item.deliveryUrl }}
                accessibilityLabel={item.altText ?? `Imagen ${index + 1} de la propiedad`}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: paltaTheme.spacing.lg }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
                  {item.role === 'floor_plan' ? 'Plano' : index === 0 ? 'Imagen principal' : `Imagen ${index + 1}`}
                </Text>
                <Text style={{ marginTop: 6, textAlign: 'center', fontSize: 12, color: paltaTheme.color.textMuted }}>
                  Asset {item.mediaAssetId} · delivery pendiente de Media Core
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: paltaTheme.color.textSecondary }}>
                {index + 1}/{items.length}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
