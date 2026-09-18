import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

const SHORTCUTS = [
  { key: 'map', title: 'Mapa', subtitle: 'Explorar por zona' },
  { key: 'owner', title: 'Dueño directo', subtitle: 'Sin corredor' },
  { key: 'building', title: 'Edificios', subtitle: 'Datos y entorno' },
  { key: 'reviews', title: 'Vivir aquí', subtitle: 'Experiencias reales' },
  { key: 'commute', title: 'Traslado', subtitle: 'Tiempo al trabajo' },
] as const;

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
      {action ? <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>{action}</Text> : null}
    </View>
  );
}

export function RealEstateHomeSections() {
  return (
    <View style={{ gap: paltaTheme.spacing.xl }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: paltaTheme.spacing.xs }}
      >
        {SHORTCUTS.map((shortcut) => (
          <Pressable
            key={shortcut.key}
            accessibilityRole="button"
            onPress={() => {
              if (shortcut.key === 'map') router.push('/propiedades/map');
            }}
            style={({ pressed }) => ({
              width: 128,
              minHeight: 84,
              padding: paltaTheme.spacing.sm,
              justifyContent: 'space-between',
              borderRadius: paltaTheme.radius.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              backgroundColor: pressed ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{shortcut.title}</Text>
            <Text style={{ fontSize: 11, lineHeight: 15, color: paltaTheme.color.textMuted }}>{shortcut.subtitle}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ gap: paltaTheme.spacing.sm }}>
        <SectionTitle title="Zonas que estás explorando" action="Ver mapa" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: paltaTheme.spacing.sm }}>
          {[
            ['Vitacura', 'Departamentos · parques · colegios'],
            ['Providencia', 'Metro · comercio · caminable'],
            ['Ñuñoa', 'Barrios residenciales · Metro'],
          ].map(([title, subtitle]) => (
            <View
              key={title}
              style={{
                width: 220,
                minHeight: 112,
                padding: paltaTheme.spacing.md,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
              <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>{subtitle}</Text>
              <Text style={{ marginTop: 'auto', fontSize: 10, color: paltaTheme.color.textMuted }}>Resumen demo · conectar datos de zona</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: paltaTheme.spacing.sm }}>
        <SectionTitle title="Vivir aquí" action="Ver experiencias" />
        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.surface,
            borderWidth: 1,
            borderColor: paltaTheme.color.divider,
            gap: 7,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Providencia · demo de experiencia residencial</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
            Buen acceso caminando a Metro y servicios. Este bloque quedará conectado a reseñas verificadas por edificio y barrio.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Transporte', 'Ruido', 'Comercio', 'Familias'].map((tag) => (
              <View key={tag} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surfaceMuted }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: paltaTheme.color.textSecondary }}>{tag}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 10, color: paltaTheme.color.textMuted }}>Contenido demo · no representa una reseña real</Text>
        </View>
      </View>

      <View style={{ gap: paltaTheme.spacing.sm }}>
        <SectionTitle title="Herramientas" />
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
          <View style={{ flex: 1, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface, borderWidth: 1, borderColor: paltaTheme.color.divider }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Guardar búsqueda</Text>
            <Text style={{ marginTop: 5, fontSize: 11, lineHeight: 15, color: paltaTheme.color.textMuted }}>Recibir nuevas propiedades cuando el Event Core esté conectado.</Text>
          </View>
          <View style={{ flex: 1, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface, borderWidth: 1, borderColor: paltaTheme.color.divider }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Comparar zonas</Text>
            <Text style={{ marginTop: 5, fontSize: 11, lineHeight: 15, color: paltaTheme.color.textMuted }}>Precio, entorno y tiempos de traslado en una sola vista.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
