import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import {
  findDemoAcquisitionRequest,
  selectDemoDealerOffer,
  useAutosAcquisitionDemoState,
} from './autosAcquisitionDemoState';

function clp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function minutesLabel(value: number) {
  if (value < 60) return `Respondió en ${value} min`;
  return `Respondió en ${Math.round(value / 60)} h`;
}

export function AutosDealerOffersScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  useAutosAcquisitionDemoState();
  const view = findDemoAcquisitionRequest(requestId);

  if (!view) {
    return (
      <SafeAreaView style={{ flex: 1, padding: paltaTheme.spacing.xl, backgroundColor: paltaTheme.color.canvas }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Solicitud no disponible</Text>
      </SafeAreaView>
    );
  }

  const sortedOffers = [...view.offers].sort((a, b) => b.offer.amountClp - a.offer.amountClp);
  const selectedOffer = view.selectedOfferId
    ? view.offers.find((item) => item.offer.id === view.selectedOfferId)
    : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Ofertas por tu auto</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>{view.vehicleLabel}</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: 5, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
            {sortedOffers.length} automotoras respondieron · demo
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Las ofertas están ordenadas por monto sólo para comparar. Palta no elige por ti ni favorece a una automotora por pagar publicidad.
          </Text>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: 4, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>Tu solicitud</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{view.vehicleLabel}</Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            {new Intl.NumberFormat('es-CL').format(view.mileageKm)} km · {view.request.comuna}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Tu teléfono y ubicación exacta siguen privados. Se comparten sólo cuando eliges con quién coordinar.
          </Text>
        </View>

        {selectedOffer ? (
          <View style={{ padding: paltaTheme.spacing.lg, gap: 7, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Elegiste con quién avanzar</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{clp(selectedOffer.offer.amountClp)}</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{selectedOffer.businessName}</Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
              El siguiente paso es coordinar inspección y lugar. La oferta sólo puede ajustarse por diferencias reales con la información declarada, dejando motivo y evidencia.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/autos/sale-care/${encodeURIComponent(view.request.id)}`)}
              style={({ pressed }) => ({
                minHeight: 50,
                marginTop: paltaTheme.spacing.xs,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.control,
                backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.surface }}>Coordinar y seguir la venta</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/autos/dealer/${encodeURIComponent(selectedOffer.offer.businessId)}`)}
              style={{ marginTop: paltaTheme.spacing.xs }}
            >
              <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Ver automotora ›</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            {sortedOffers.map((item, index) => (
              <View
                key={item.offer.id}
                style={{
                  padding: paltaTheme.spacing.md,
                  gap: paltaTheme.spacing.sm,
                  borderRadius: paltaTheme.radius.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.divider,
                  backgroundColor: paltaTheme.color.surface,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: paltaTheme.color.textMuted }}>
                      {index === 0 ? 'Mayor oferta' : `Oferta ${index + 1}`}
                    </Text>
                    <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{clp(item.offer.amountClp)}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.businessName}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.brandSoft }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
                      {item.offerKind === 'firm' ? 'Oferta firme' : 'Preliminar'}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
                    {item.offerRespectRatePct}% de ofertas respetadas · {item.completedDeals} operaciones
                  </Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{minutesLabel(item.responseMinutes)}</Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{item.paymentLabel}</Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{item.transferLabel}</Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
                    {item.inspectionRequired ? 'Requiere inspección antes del cierre' : 'No requiere nueva inspección'}
                  </Text>
                </View>

                {item.offer.note ? (
                  <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>{item.offer.note}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectDemoDealerOffer(view.request.id, item.offer.id)}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: paltaTheme.radius.control,
                    backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.surface }}>Elegir y coordinar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ padding: paltaTheme.spacing.md, gap: 5, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Regla Palta para ajustes</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Una automotora no debería subir la oferta para ganar y luego bajarla sin explicación. Cualquier ajuste debe indicar qué cambió, cuánto afecta y adjuntar evidencia de la inspección.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
