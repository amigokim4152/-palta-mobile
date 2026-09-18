import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import {
  AUTOS_CAPTURE_SLOTS,
  hasRequiredVehicleCaptures,
  type VehicleCaptureSlotId,
} from '../../../../src/autos/autosCaptureFlow';
import { estimateChileVehicleTransaction } from '../../../../src/autos/chileVehicleTransaction';
import { paltaTheme } from '../../theme/paltaTheme';
import { createDemoAcquisitionRequest } from './autosAcquisitionDemoState';
import { publishDemoVehicle } from './autosDemoState';

type SellStep = 'identify' | 'photos' | 'confirm' | 'method';
type SellMethod = 'dealer_offers' | 'direct';

function digits(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function clp(value: number) {
  return `$${new Intl.NumberFormat('es-CL').format(value)}`;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textSecondary }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={paltaTheme.color.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 92 : 50,
          paddingHorizontal: paltaTheme.spacing.md,
          paddingVertical: multiline ? paltaTheme.spacing.sm : 0,
          borderRadius: paltaTheme.radius.control,
          borderWidth: 1,
          borderColor: paltaTheme.color.divider,
          backgroundColor: paltaTheme.color.surface,
          color: paltaTheme.color.textPrimary,
        }}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: disabled
          ? paltaTheme.color.surfaceMuted
          : pressed
            ? paltaTheme.color.brandMid
            : paltaTheme.color.brandPrimary,
      })}
    >
      <Text style={{ fontSize: 15, fontWeight: '900', color: disabled ? paltaTheme.color.textMuted : paltaTheme.color.surface }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceCard({ selected, title, body, onPress }: { selected: boolean; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: paltaTheme.spacing.md,
        gap: 5,
        borderRadius: paltaTheme.radius.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
        backgroundColor: pressed || selected ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
      })}
    >
      <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>{body}</Text>
    </Pressable>
  );
}

export function VehicleSellDemoScreen() {
  const [step, setStep] = useState<SellStep>('identify');
  const [plate, setPlate] = useState('LXXX00');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('RAV4');
  const [year, setYear] = useState('2021');
  const [mileage, setMileage] = useState('48.200');
  const [comuna, setComuna] = useState('Las Condes');
  const [conditionNote, setConditionNote] = useState('Mantenciones al día y dos llaves.');
  const [price, setPrice] = useState('18.990.000');
  const [capturedSlots, setCapturedSlots] = useState<VehicleCaptureSlotId[]>([]);
  const [sellMethod, setSellMethod] = useState<SellMethod>('dealer_offers');
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredPhotoCount = useMemo(() => AUTOS_CAPTURE_SLOTS.filter((slot) => slot.required).length, []);
  const completedRequiredPhotoCount = useMemo(
    () => AUTOS_CAPTURE_SLOTS.filter((slot) => slot.required && capturedSlots.includes(slot.id)).length,
    [capturedSlots],
  );
  const requiredPhotosReady = hasRequiredVehicleCaptures(capturedSlots);
  const priceValue = digits(price);
  const directSaleEstimate = useMemo(
    () => estimateChileVehicleTransaction({ salePriceClp: priceValue, costBearer: 'buyer' }),
    [priceValue],
  );

  function toggleCapture(slotId: VehicleCaptureSlotId) {
    setCapturedSlots((current) =>
      current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId],
    );
  }

  function goToPhotos() {
    if (!plate.trim()) {
      setError('Ingresa la patente para continuar.');
      return;
    }
    setError(null);
    setStep('photos');
  }

  function goToConfirm() {
    if (!requiredPhotosReady) {
      setError('Completa las 5 fotos básicas para continuar.');
      return;
    }
    setError(null);
    setStep('confirm');
  }

  function goToMethod() {
    const yearValue = digits(year);
    const mileageValue = digits(mileage);
    if (!make.trim() || !model.trim() || !comuna.trim()) {
      setError('Revisa los datos básicos del vehículo.');
      return;
    }
    if (yearValue < 1980 || yearValue > new Date().getFullYear() + 1 || mileageValue < 0) {
      setError('Revisa año y kilometraje.');
      return;
    }
    setError(null);
    setStep('method');
  }

  function publishDirect() {
    const yearValue = digits(year);
    const mileageValue = digits(mileage);
    if (priceValue <= 0) {
      setError('Ingresa el precio que quieres pedir.');
      return;
    }

    const item = publishDemoVehicle({
      make,
      model,
      year: yearValue,
      mileageKm: mileageValue,
      priceClp: priceValue,
      comuna,
      description: conditionNote,
    });
    setError(null);
    router.replace(`/autos/listing/${encodeURIComponent(item.listing.id)}`);
  }

  function requestDealerOffers() {
    const yearValue = digits(year);
    const mileageValue = digits(mileage);
    const request = createDemoAcquisitionRequest({
      make,
      model,
      year: yearValue,
      mileageKm: mileageValue,
      comuna,
      askingReferenceClp: priceValue > 0 ? priceValue : undefined,
    });
    setError(null);
    router.push(`/autos/offers/${encodeURIComponent(request.request.id)}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable
            onPress={() => (step === 'identify' ? router.back() : setStep(step === 'photos' ? 'identify' : step === 'confirm' ? 'photos' : 'confirm'))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Vender mi auto</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Te pedimos sólo lo necesario</Text>
          </View>
        </View>

        {step === 'identify' ? (
          <>
            <View style={{ padding: paltaTheme.spacing.md, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>1 · Identifica tu auto</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Empezamos por la patente. Cuando una fuente autorizada pueda completar datos, Palta te pedirá confirmarlos en vez de escribirlos de nuevo.
              </Text>
            </View>
            <Field label="Patente" value={plate} onChangeText={setPlate} placeholder="ABCD12" />
            <View style={{ padding: paltaTheme.spacing.md, gap: 4, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>Vehículo de esta demo</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{make} {model} · {year}</Text>
              <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>La patente completa no se publica.</Text>
            </View>
            {error ? <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.danger }}>{error}</Text> : null}
            <PrimaryButton label="Sí, continuar" onPress={goToPhotos} />
          </>
        ) : null}

        {step === 'photos' ? (
          <>
            <View style={{ padding: paltaTheme.spacing.md, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>2 · Fotos guiadas</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                {completedRequiredPhotoCount} de {requiredPhotoCount} fotos básicas. No necesitas saber de autos: te decimos exactamente qué mostrar.
              </Text>
            </View>

            <View style={{ gap: paltaTheme.spacing.sm }}>
              {AUTOS_CAPTURE_SLOTS.map((slot, index) => {
                const captured = capturedSlots.includes(slot.id);
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => toggleCapture(slot.id)}
                    style={({ pressed }) => ({
                      minHeight: 106,
                      padding: paltaTheme.spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: paltaTheme.spacing.md,
                      borderRadius: paltaTheme.radius.surface,
                      borderWidth: captured ? 2 : 1,
                      borderColor: captured ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                      backgroundColor: pressed || captured ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
                    })}
                  >
                    <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: paltaTheme.radius.control, backgroundColor: paltaTheme.color.surfaceMuted }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{captured ? '✓' : index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{slot.title}{slot.required ? '' : ' · opcional'}</Text>
                      <Text style={{ fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>{slot.guidance}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: captured ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted }}>{captured ? 'Foto lista' : 'Tomar foto'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Al inicio Palta sólo guía la captura. Más adelante se podrá añadir lectura local, datos de socios o análisis automático sin cambiar este flujo.
              </Text>
            </View>
            {error ? <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.danger }}>{error}</Text> : null}
            <PrimaryButton label="Continuar" onPress={goToConfirm} disabled={!requiredPhotosReady} />
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <View style={{ padding: paltaTheme.spacing.md, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>3 · Confirma lo importante</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                No repetimos información. Sólo corrige lo que no coincida y agrega lo que un comprador necesita saber.
              </Text>
            </View>

            <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{make} {model}</Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textSecondary }}>{year} · {plate}</Text>
                </View>
                <Pressable onPress={() => setEditingIdentity((value) => !value)}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>{editingIdentity ? 'Listo' : 'Corregir'}</Text>
                </Pressable>
              </View>
              {editingIdentity ? (
                <View style={{ gap: paltaTheme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
                    <View style={{ flex: 1 }}><Field label="Marca" value={make} onChangeText={setMake} /></View>
                    <View style={{ flex: 1 }}><Field label="Modelo" value={model} onChangeText={setModel} /></View>
                  </View>
                  <Field label="Año" value={year} onChangeText={setYear} keyboardType="number-pad" />
                </View>
              ) : null}
            </View>

            <Field label="Kilometraje" value={mileage} onChangeText={setMileage} keyboardType="number-pad" />
            <Field label="Comuna" value={comuna} onChangeText={setComuna} />
            <Field label="¿Hay algo importante que debamos informar?" value={conditionNote} onChangeText={setConditionNote} multiline />

            <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Tus documentos, identidad, patente completa y ubicación exacta se mantienen fuera del aviso público y sólo se comparten cuando el proceso lo necesita.
              </Text>
            </View>
            {error ? <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.danger }}>{error}</Text> : null}
            <PrimaryButton label="Ver formas de vender" onPress={goToMethod} />
          </>
        ) : null}

        {step === 'method' ? (
          <>
            <View style={{ padding: paltaTheme.spacing.md, gap: 6, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>4 · Tú decides cómo vender</Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Palta prepara la información una sola vez. Puedes pedir ofertas a automotoras o publicar el mismo auto para venta directa.
              </Text>
            </View>

            <View style={{ gap: paltaTheme.spacing.sm }}>
              <ChoiceCard
                selected={sellMethod === 'dealer_offers'}
                title="Recibir ofertas de automotoras"
                body="No necesitas fijar un precio ahora. Automotoras verificadas podrán enviar ofertas y tú eliges si aceptas alguna."
                onPress={() => setSellMethod('dealer_offers')}
              />
              <ChoiceCard
                selected={sellMethod === 'direct'}
                title="Publicar para venta directa"
                body="Tú defines el precio y conversas con compradores. La ficha pública reutiliza la información que ya preparaste."
                onPress={() => setSellMethod('direct')}
              />
            </View>

            {sellMethod === 'direct' ? (
              <>
                <Field label="Precio que quieres pedir" value={price} onChangeText={setPrice} keyboardType="number-pad" />
                {priceValue > 0 ? (
                  <View style={{ padding: paltaTheme.spacing.md, gap: 8, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Así se verían los costos</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Precio de venta</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{clp(priceValue)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Impuesto transferencia · 1,5%</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{clp(directSaleEstimate.transferTaxClp)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Trámite oficial civil</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{clp(directSaleEstimate.civilOfficerProcedureFeeClp)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                      <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Inscripción vehículo</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{clp(directSaleEstimate.motorVehicleRegistryFeeClp)}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: paltaTheme.color.divider }} />
                    <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>Si el comprador asume los costos de transferencia:</Text>
                    <Text style={{ fontSize: 23, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Tú recibirías aprox. {clp(directSaleEstimate.sellerEstimatedNetClp)}</Text>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
                      El comprador desembolsaría aprox. {clp(directSaleEstimate.buyerEstimatedOutlayClp)}. Cuando conectemos la referencia SII, Palta aplicará automáticamente la base legal correspondiente sin pedirte calcular nada.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={{ padding: paltaTheme.spacing.md, gap: 5, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Tú no eliges a ciegas</Text>
                <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                  Compararemos monto, tipo de oferta, necesidad de inspección, historial de respeto de ofertas y condiciones de pago. Tu contacto y ubicación exacta siguen privados hasta que elijas una automotora.
                </Text>
              </View>
            )}

            <View style={{ padding: paltaTheme.spacing.md, gap: 5, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Los costos y reglas están versionados fuera de esta pantalla para poder actualizar cambios legales o tarifarios sin rehacer el flujo de venta.
              </Text>
            </View>

            {error ? <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.danger }}>{error}</Text> : null}
            {sellMethod === 'direct' ? (
              <PrimaryButton label="Publicar demo" onPress={publishDirect} />
            ) : (
              <PrimaryButton label="Solicitar ofertas · demo" onPress={requestDealerOffers} />
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
