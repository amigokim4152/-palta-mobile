import { Image, ScrollView, View } from 'react-native';
import { SectionHeading } from '../common/SectionHeading';

export function BusinessPhotoStrip({
  photoUrls,
}: {
  photoUrls: readonly string[];
}) {
  const photos = photoUrls.filter(Boolean).slice(0, 6);
  if (!photos.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <SectionHeading title="Fotos" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {photos.map((url, index) => (
          <Image
            key={`${url}:${index}`}
            source={{ uri: url }}
            accessibilityLabel={`Foto ${index + 1} del negocio`}
            resizeMode="cover"
            style={{ width: 220, height: 150, borderRadius: 16 }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
