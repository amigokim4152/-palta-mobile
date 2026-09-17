import { Image, ScrollView, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export function BusinessPhotoStrip({
  photoUrls,
}: {
  photoUrls: readonly string[];
}) {
  const photos = photoUrls.filter(Boolean).slice(0, 6);
  if (!photos.length) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ gap: paltaTheme.spacing.xs }}
      >
        {photos.map((url, index) => (
          <Image
            key={`${url}:${index}`}
            source={{ uri: url }}
            accessibilityLabel={`Foto ${index + 1} del negocio`}
            resizeMode="cover"
            style={{
              width: index === 0 ? 286 : 238,
              height: 188,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surfaceMuted,
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
