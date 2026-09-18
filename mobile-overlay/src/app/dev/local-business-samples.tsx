import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { LocalResultCard } from '../../components/LocalResultCard';
import { BusinessActionBar } from '../../components/business/BusinessActionBar';
import { paltaTheme } from '../../theme/paltaTheme';

function Pin({ left, top, label, selected = false }: { left: `${number}%`; top: number; label: string; selected?: boolean }) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width: selected ? 42 : 34,
        height: selected ? 42 : 34,
        marginLeft: selected ? -21 : -17,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.surface,
        borderWidth: 2,
        borderColor: selected ? paltaTheme.color.surface : paltaTheme.color.brandPrimary,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: selected ? paltaTheme.color.surface : paltaTheme.color.brandPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DiscoverySample() {
  return (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <View>
        <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
          SAMPLE 01
        </Text>
        <Text style={{ marginTop: 3, fontSize: 22, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Negocios · mapa + resultados
        </Text>
        <Text style={{ marginTop: 4, lineHeight: 20, color: paltaTheme.color.textSecondary }}>
          En tres segundos debe quedar claro qué es, si se puede usar ahora y por qué vale la pena abrirlo.
        </Text>
      </View>

      <View
        style={{
          height: 320,
          overflow: 'hidden',
          borderRadius: paltaTheme.radius.prominent,
          backgroundColor: paltaTheme.color.surfaceMuted,
          position: 'relative',
        }}
      >
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200 }}>
          <View
            style={{
              position: 'absolute',
              left: '8%',
              right: '5%',
              top: 76,
              height: 12,
              borderRadius: 999,
              backgroundColor: paltaTheme.color.divider,
              transform: [{ rotate: '-7deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: '34%',
              top: 8,
              bottom: 0,
              width: 9,
              borderRadius: 999,
              backgroundColor: paltaTheme.color.divider,
              transform: [{ rotate: '18deg' }],
            }}
          />
          <Pin left="36%" top={54} label="T" selected />
          <Pin left="73%" top={103} label="F" />
        </View>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            minHeight: 170,
            paddingHorizontal: paltaTheme.spacing.md,
            paddingTop: paltaTheme.spacing.sm,
            borderTopLeftRadius: paltaTheme.radius.prominent,
            borderTopRightRadius: paltaTheme.radius.prominent,
            backgroundColor: paltaTheme.color.surface,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 42,
              height: 4,
              borderRadius: 999,
              backgroundColor: paltaTheme.color.border,
              marginBottom: paltaTheme.spacing.xs,
            }}
          />
          <LocalResultCard
            selected
            name="Taller Los Andes"
            meta="Abierto ahora · auto_repair · Verificado"
            distance="850 m"
            serviceLabels={['Mantención', 'Frenos']}
            highlight="Agenda disponible esta semana"
          />
        </View>
      </View>

      <View style={{ backgroundColor: paltaTheme.color.surface, borderRadius: paltaTheme.radius.surface, paddingHorizontal: paltaTheme.spacing.md }}>
        <LocalResultCard
          name="Farmacia Manquehue"
          meta="Abierto ahora · pharmacy · Verificado"
          distance="1,2 km"
          serviceLabels={['Farmacia', 'Cuidado personal']}
          highlight="10% en cuidado personal"
        />
      </View>
    </View>
  );
}

function ProfileSample() {
  return (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <View>
        <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
          SAMPLE 02
        </Text>
        <Text style={{ marginTop: 3, fontSize: 22, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Business Profile · decisión + acción
        </Text>
        <Text style={{ marginTop: 4, lineHeight: 20, color: paltaTheme.color.textSecondary }}>
          La primera pantalla responde: qué es, si está disponible ahora y qué puedo hacer aquí.
        </Text>
      </View>

      <View style={{ overflow: 'hidden', borderRadius: paltaTheme.radius.prominent, backgroundColor: paltaTheme.color.canvas }}>
        <View
          style={{
            height: 210,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ fontSize: 68, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>P</Text>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.sm }}>
          <View style={{ gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.xs }}>
              <Text style={{ flex: 1, fontSize: 26, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Panadería Los Alerces
              </Text>
              <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: paltaTheme.color.brandSoft }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Verificado</Text>
              </View>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: paltaTheme.color.textSecondary }}>
              Panadería · Café
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              Abierto ahora · Vitacura
            </Text>
          </View>

          <BusinessActionBar
            capabilities={['quote', 'whatsapp', 'call', 'save', 'follow']}
            verificationStatus="verified"
            relationship={{ saved: false, following: true }}
            onAction={() => undefined}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            {['Panadería', 'Café', 'Desayuno'].map((label) => (
              <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: paltaTheme.color.surfaceMuted }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.textSecondary }}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.avocadoCream }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>BENEFICIO</Text>
            <Text style={{ marginTop: 4, fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
              10% en café con compra de pan
            </Text>
          </View>

          <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>OPINIONES VERIFICADAS</Text>
            <Text style={{ marginTop: 5, fontWeight: '800', color: paltaTheme.color.textPrimary }}>4,8 ★ · 23 opiniones</Text>
            <Text style={{ marginTop: 5, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
              “Muy buena atención y el pan estaba recién hecho.”
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function LocalBusinessSamplesScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 60, gap: 34 }}
      >
        <DiscoverySample />
        <ProfileSample />
      </ScrollView>
    </SafeAreaView>
  );
}
