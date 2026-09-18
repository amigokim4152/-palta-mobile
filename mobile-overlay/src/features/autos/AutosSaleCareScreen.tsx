import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  VEHICLE_SALE_CARE_CHECKLIST,
  buildVehicleSaleCareTrack,
} from '../../../../src/autos/autosSaleCare';
import { buildVehicleSalePreparation } from '../../../../src/autos/autosSalePreparation';
import { paltaTheme } from '../../theme/paltaTheme';
import { findDemoAcquisitionRequest } from './autosAcquisitionDemoState';
import {
  advanceDemoVehicleSaleCare,
  ensureDemoVehicleSaleCare,
  useAutosSaleCareDemoState,
} from './autosSaleCareDemoState';

function clp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

export function AutosSaleCareScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  useAutosSaleCareDemoState();
  const acquisition = findDemoAcquisitionRequest(requestId);
  const care = ensureDemoVehicleSaleCare(requestId);

  if (!acquisition || !care) {
    return (
      <SafeAreaView style={{ flex: 1, padding: paltaTheme.spacing.xl, backgroundColor: paltaTheme.color.canvas }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Venta no disponible</Text>
      </SafeAreaView>
    );
  }

  const selectedOffer = acquisition.offers.find((item) => item.offer.id === care.selectedOfferId);
  const track = buildVehicleSaleCareTrack({
    careId: `autos-sale-${requestId}`,
    acquisitionRequestId: requestId,
    selectedOfferId: care.selectedOfferId,
    records: care.records,
  });

  // Demo has no connected SII snapshot yet. Once the official adapter is connected,
  // its verified vehicle snapshot is passed here without changing this screen flow.
  const salePreparation = buildVehicleSalePreparation({
    snapshots: [],
    salePriceClp: care.finalPriceClp,
    costBearer: 'buyer',
  });
  const transaction = salePreparation.transactionEstimate;
  const hasOfficialFiscalFloor = salePreparation.estimateConfidence === 'official_floor_applied';

  const completed = new Set(care.records.map((record) => record.milestone));
  const latest = care.records[care.records.length - 1];
  const done = latest?.milestone === 'vehicle_handed_over';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Venta de tu auto</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>{acquisition.vehicleLabel}</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Palta Care · demo</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{clp(care.finalPriceClp)}</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{selectedOffer?.businessName}</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Estado compartido: {track.state}. Palta mantiene el proceso unido hasta que pago, transferencia y entrega queden confirmados.
          </Text>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: 7, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Costos estimados de transferencia</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: paltaTheme.radius.pill, backgroundColor: hasOfficialFiscalFloor ? paltaTheme.color.brandSoft : paltaTheme.color.surfaceMuted }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: hasOfficialFiscalFloor ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>
                {hasOfficialFiscalFloor ? 'SII verificado' : 'Estimación mínima'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>
            Impuesto estimado{hasOfficialFiscalFloor ? '' : ' mínimo'}: {clp(transaction.transferTaxClp)}
          </Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Registro: {clp(transaction.motorVehicleRegistryFeeClp)}</Text>
          <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Declaración ante oficial civil: {clp(transaction.civilOfficerProcedureFeeClp)}</Text>
          <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Total estimado{hasOfficialFiscalFloor ? '' : ' mínimo'}: {clp(transaction.totalTransferCostsClp)}
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 17, color: paltaTheme.color.textMuted }}>
            {hasOfficialFiscalFloor
              ? 'La estimación ya incorpora la tasación fiscal SII resuelta para el vehículo. Esta demo asume que la parte compradora cubre los costos.'
              : 'Palta todavía no resolvió una tasación SII única para este vehículo. No te bloqueamos por eso: mostramos el mínimo conocido y lo afinaremos automáticamente cuando la fuente oficial esté conectada. Esta demo asume que la parte compradora cubre los costos.'}
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.xs }}>
          {VEHICLE_SALE_CARE_CHECKLIST.map((item) => {
            const isDone = completed.has(item.milestone);
            const isCurrent = latest?.milestone === item.milestone;
            return (
              <View
                key={item.milestone}
                style={{
                  minHeight: 58,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: paltaTheme.spacing.sm,
                  paddingHorizontal: paltaTheme.spacing.md,
                  borderRadius: paltaTheme.radius.control,
                  borderWidth: 1,
                  borderColor: isCurrent ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                  backgroundColor: isDone ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? paltaTheme.color.brandPrimary : paltaTheme.color.surfaceMuted }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: isDone ? paltaTheme.color.surface : paltaTheme.color.textMuted }}>{isDone ? '✓' : '·'}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: isCurrent ? '900' : '700', color: paltaTheme.color.textPrimary }}>{item.userLabel}</Text>
              </View>
            );
          })}
        </View>

        {!done ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => advanceDemoVehicleSaleCare(requestId)}
            style={({ pressed }) => ({
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.surface }}>Avanzar siguiente paso · demo</Text>
          </Pressable>
        ) : (
          <View style={{ padding: paltaTheme.spacing.lg, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Venta completada</Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
              En producción, el vehículo pasa al historial de la persona vendedora y puede aparecer en Mis autos del nuevo propietario cuando exista consentimiento y vínculo de cuenta.
            </Text>
            <Pressable onPress={() => router.replace('/autos')}>
              <Text style={{ marginTop: paltaTheme.spacing.xs, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Volver a Autos ›</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
