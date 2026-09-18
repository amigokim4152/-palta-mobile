import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

function Field({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textSecondary }}>{label}</Text>
      <TextInput
        defaultValue={value}
        placeholder={placeholder}
        placeholderTextColor={paltaTheme.color.textMuted}
        style={{ minHeight: 50, paddingHorizontal: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.control, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface, color: paltaTheme.color.textPrimary }}
      />
    </View>
  );
}

export function VehicleSellDemoScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Vender mi auto</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Demo del flujo de publicación</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>1 de 3 · Identifica el vehículo</Text>
          <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>
            En producción Palta intentará completar datos verificables del vehículo antes de pedirlos manualmente.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Field label="Patente" value="LXXX00" />
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
            <View style={{ flex: 1 }}><Field label="Marca" value="Toyota" /></View>
            <View style={{ flex: 1 }}><Field label="Modelo" value="RAV4" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
            <View style={{ flex: 1 }}><Field label="Año" value="2021" /></View>
            <View style={{ flex: 1 }}><Field label="Kilometraje" value="48.200" /></View>
          </View>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Tu publicación</Text>
          <Field label="Precio" value="$18.990.000" />
          <Field label="Comuna" value="Las Condes" />
          <Field label="Descripción" value="Uso familiar, mantenciones al día y dos llaves." />
          <View style={{ minHeight: 120, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: paltaTheme.color.border, backgroundColor: paltaTheme.color.surface }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>Agregar fotos</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: paltaTheme.color.textMuted }}>Frente · interior · laterales · detalles</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Antes de publicar</Text>
          <Text style={{ marginTop: 5, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Palta separará los datos privados del propietario de la información pública del aviso. La patente completa y documentos no deben exponerse en la ficha pública.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandPrimary }}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.surface }}>Continuar · demo</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
