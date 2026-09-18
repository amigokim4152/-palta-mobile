import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { paltaTheme } from '../../theme/paltaTheme';

function digits(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function clp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

const DEMO_PRIVATE_SELLER_REQUESTS = [
  {
    id: 'dealer-request-demo-001',
    vehicleLabel: 'Toyota Corolla · 2020',
    mileageKm: 58_400,
    comuna: 'Las Condes',
    photoCount: 5,
    note: 'Mantenciones al día. Vendedor declaró un detalle menor en parachoques.',
  },
  {
    id: 'dealer-request-demo-002',
    vehicleLabel: 'Kia Sportage · 2021',
    mileageKm: 43_900,
    comuna: 'Vitacura',
    photoCount: 6,
    note: 'Dos llaves y revisión técnica vigente declarada.',
  },
] as const;

export function AutosDealerBusinessScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const inventory = useMemo(
    () => AUTOS_DEMO_LISTINGS.filter((item) => item.listing.publisherBusinessId === businessId),
    [businessId],
  );
  const [acquisitionEnabled, setAcquisitionEnabled] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState('15.800.000');
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Autos · Panel del negocio</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>{businessId}</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Comprar autos de particulares</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Recibe solicitudes que cumplen tus criterios. No compras acceso preferente a la fila orgánica.
              </Text>
            </View>
            <Pressable
              onPress={() => setAcquisitionEnabled((value) => !value)}
              style={({ pressed }) => ({
                minWidth: 68,
                minHeight: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: acquisitionEnabled ? paltaTheme.color.brandPrimary : paltaTheme.color.surface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '900', color: acquisitionEnabled ? paltaTheme.color.surface : paltaTheme.color.textSecondary }}>
                {acquisitionEnabled ? 'Activo' : 'Pausado'}
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, lineHeight: 17, color: paltaTheme.color.textMuted }}>
            Demo: RM · Las Condes, Providencia y Vitacura · desde 2015 · hasta 180.000 km. En producción estos criterios viven en el registro de capacidades del Business.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Solicitudes para comprar</Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{acquisitionEnabled ? DEMO_PRIVATE_SELLER_REQUESTS.length : 0}</Text>
          </View>

          {!acquisitionEnabled ? (
            <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Activa la compra de particulares para recibir solicitudes compatibles.</Text>
            </View>
          ) : null}

          {acquisitionEnabled
            ? DEMO_PRIVATE_SELLER_REQUESTS.map((request) => {
                const selected = selectedRequestId === request.id;
                const sent = sentRequestIds.includes(request.id);
                return (
                  <View key={request.id} style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
                    <View style={{ gap: 3 }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{request.vehicleLabel}</Text>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
                        {new Intl.NumberFormat('es-CL').format(request.mileageKm)} km · {request.comuna} · {request.photoCount} fotos
                      </Text>
                      <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>{request.note}</Text>
                      <Text style={{ fontSize: 11, lineHeight: 17, color: paltaTheme.color.textMuted }}>
                        Teléfono, identidad y dirección exacta no se muestran antes de que la persona vendedora elija avanzar contigo.
                      </Text>
                    </View>

                    {sent ? (
                      <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.control, backgroundColor: paltaTheme.color.brandSoft }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Oferta enviada · demo</Text>
                        <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textSecondary }}>{clp(digits(offerAmount))}</Text>
                      </View>
                    ) : selected ? (
                      <>
                        <View style={{ gap: 5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textSecondary }}>Tu oferta preliminar</Text>
                          <TextInput
                            value={offerAmount}
                            onChangeText={setOfferAmount}
                            keyboardType="number-pad"
                            style={{ minHeight: 48, paddingHorizontal: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.control, borderWidth: 1, borderColor: paltaTheme.color.divider, color: paltaTheme.color.textPrimary, backgroundColor: paltaTheme.color.canvas }}
                          />
                        </View>
                        <Text style={{ fontSize: 11, lineHeight: 17, color: paltaTheme.color.textMuted }}>
                          Si luego bajas esta oferta, Palta exigirá motivo, monto del ajuste y evidencia de inspección.
                        </Text>
                        <Pressable
                          disabled={digits(offerAmount) <= 0}
                          onPress={() => setSentRequestIds((current) => [...current, request.id])}
                          style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.control, backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary, opacity: digits(offerAmount) > 0 ? 1 : 0.45 })}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.surface }}>Enviar oferta</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        onPress={() => setSelectedRequestId(request.id)}
                        style={({ pressed }) => ({ minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.control, backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.canvas, borderWidth: 1, borderColor: paltaTheme.color.divider })}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Revisar y ofertar</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            : null}
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: 5, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Inventario conectado</Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{inventory.length} publicaciones asociadas a este businessId.</Text>
          <Text style={{ fontSize: 11, lineHeight: 17, color: paltaTheme.color.textMuted }}>
            Más adelante el mismo panel podrá recibir stock por carga masiva/API y sincronizar canales externos sin duplicar la identidad del Business.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
