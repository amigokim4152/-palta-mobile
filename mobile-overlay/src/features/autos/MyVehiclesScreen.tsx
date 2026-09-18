import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { useAutosDemoState } from './autosDemoState';

function StatusRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md, paddingVertical: paltaTheme.spacing.sm, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{label}</Text>
        <Text style={{ marginTop: 2, fontSize: 11, color: paltaTheme.color.textMuted }}>{note}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>{value}</Text>
    </View>
  );
}

export function MyVehiclesScreen() {
  const demoState = useAutosDemoState();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View>
          <Text style={{ fontSize: 27, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Mis autos</Text>
          <Text style={{ marginTop: 3, fontSize: 13, color: paltaTheme.color.textMuted }}>Tus vehículos, publicaciones y próximos cuidados</Text>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, gap: paltaTheme.spacing.xs }}>
          <Text style={{ fontSize: 19, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Toyota RAV4 2021</Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>48.200 km · vehículo demo</Text>
          <View style={{ marginTop: paltaTheme.spacing.xs, paddingHorizontal: paltaTheme.spacing.sm, paddingVertical: 8, alignSelf: 'flex-start', borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Vehículo principal</Text>
          </View>
        </View>

        {demoState.publishedListings.length ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Publicaciones activas</Text>
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{demoState.publishedListings.length}</Text>
            </View>
            {demoState.publishedListings.map((item) => (
              <Pressable
                key={item.listing.id}
                accessibilityRole="button"
                onPress={() => router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`)}
                style={({ pressed }) => ({
                  padding: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.divider,
                  backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{item.listing.title}</Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: paltaTheme.color.textMuted }}>
                  {item.listing.comuna} · ${new Intl.NumberFormat('es-CL').format(item.listing.priceClp)}
                </Text>
                <Text style={{ marginTop: 7, fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
                  Ver publicación ›
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ borderRadius: paltaTheme.radius.surface, paddingHorizontal: paltaTheme.spacing.md, backgroundColor: paltaTheme.color.surface, borderWidth: 1, borderColor: paltaTheme.color.divider }}>
          <StatusRow label="SOAP" value="Vigente" note="Próxima renovación: marzo 2027" />
          <StatusRow label="Permiso de Circulación" value="Vigente" note="Palta podrá recordar el próximo vencimiento" />
          <StatusRow label="Revisión Técnica" value="En 54 días" note="Preparar revisión y documentos" />
          <StatusRow label="Próxima mantención" value="1.800 km" note="Referencia demo por kilometraje" />
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft, gap: 5 }}>
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Después de comprar, el auto no desaparece</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Esta ficha será el punto de unión con talleres, neumáticos, seguro, revisión técnica, documentos, mantenciones y eventos como robo o emergencia.
          </Text>
        </View>

        <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>Fechas y estados de cuidado son datos de demostración.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
