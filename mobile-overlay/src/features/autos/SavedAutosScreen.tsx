import { router } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { VehicleListingCard } from './VehicleListingCard';

export function SavedAutosScreen() {
  const saved = AUTOS_DEMO_LISTINGS.slice(0, 2);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View>
          <Text style={{ fontSize: 27, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Guardados</Text>
          <Text style={{ marginTop: 3, fontSize: 13, color: paltaTheme.color.textMuted }}>Autos que quieres volver a revisar</Text>
        </View>
        <View style={{ gap: paltaTheme.spacing.sm }}>
          {saved.map((item) => (
            <VehicleListingCard
              key={item.listing.id}
              item={item}
              onPress={() => router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`)}
            />
          ))}
        </View>
        <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>Datos demo. La persistencia de favoritos se conectará al usuario Palta.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
