import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { LocalSearchItem } from '../../../../src/api/paltaApiClient';
import { createClientMutationId } from '../../../../src/api/retryPolicy';
import { CHILE_LOCAL_SERVICE_SEED } from '../../../../src/business/chileServiceSeed';
import { resolveServiceSuggestions } from '../../../../src/business/serviceResolver';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { ScreenFrame } from '../../components/ScreenFrame';
import { submitQuickBusinessRegistration } from '../../services/businessQuickRegistrationClient';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

type Step = 1 | 2 | 3;
type Point = { latitude: number; longitude: number };

type ServiceChoice = {
  serviceId: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
};

function Field({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  phone = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  phone?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      keyboardType={phone ? 'phone-pad' : 'default'}
      autoCapitalize={phone ? 'none' : 'sentences'}
      style={{
        minHeight: multiline ? 88 : 52,
        marginTop: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        borderRadius: 14,
        backgroundColor: paltaTheme.color.surface,
        color: paltaTheme.color.textPrimary,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 50,
        marginTop: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: secondary ? 1 : 0,
        borderColor: paltaTheme.color.divider,
        backgroundColor: secondary ? paltaTheme.color.surface : paltaTheme.color.brandPrimary,
        opacity: disabled ? 0.42 : 1,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '800',
          color: secondary ? paltaTheme.color.textPrimary : paltaTheme.color.surface,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BusinessQuickRegistrationV2Screen() {
  const [step, setStep] = useState<Step>(1);
  const [businessName, setBusinessName] = useState('');
  const [point, setPoint] = useState<Point | null>(null);
  const [matches, setMatches] = useState<LocalSearchItem[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<LocalSearchItem | null>(null);
  const [newBusiness, setNewBusiness] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceChoices, setServiceChoices] = useState<ServiceChoice[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const progress = useMemo(() => `${step} de 3`, [step]);
  const businessReady = Boolean(point && businessName.trim() && (selectedBusiness || newBusiness));
  const serviceReady = selectedServiceIds.length > 0;
  const contactReady = Boolean(whatsapp.trim() || phone.trim());

  async function locateAndSearch() {
    if (!businessName.trim()) {
      setMessage('Escribe el nombre del negocio.');
      return;
    }
    if (mobileRuntime.status !== 'ready') {
      setMessage('Palta todavía no tiene conexión pública configurada.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let permission = await expoLocationAdapter.getPermission();
      if (permission !== 'granted_foreground') {
        permission = await expoLocationAdapter.requestForegroundPermission();
      }
      if (permission !== 'granted_foreground') {
        setMessage('Para el registro rápido necesitamos la ubicación del local. Si prefieres, usa el registro completo y marca el punto manualmente.');
        return;
      }

      const current = await expoLocationAdapter.getCurrentPosition();
      setPoint(current);
      const results = await mobileRuntime.client.searchLocal({
        latitude: current.latitude,
        longitude: current.longitude,
        radiusM: 1200,
        query: businessName.trim(),
      });
      const nearbyBusinesses = results
        .filter((item) => item.entity_type === 'business')
        .slice(0, 4);
      setMatches(nearbyBusinesses);
      setSelectedBusiness(null);
      setNewBusiness(nearbyBusinesses.length === 0);
      setMessage(
        nearbyBusinesses.length
          ? 'Revisa si tu negocio ya aparece. Así evitamos fichas duplicadas.'
          : 'No encontramos una ficha cercana con ese nombre. Puedes registrarlo como nuevo.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos ubicar o buscar el negocio.');
    } finally {
      setBusy(false);
    }
  }

  function chooseExisting(item: LocalSearchItem) {
    if (item.verification_status === 'claimed' || item.verification_status === 'verified') {
      setSelectedBusiness(null);
      setNewBusiness(false);
      setMessage('Esta ficha ya tiene administración. Palta debe verificar quién solicita acceso antes de hacer cambios.');
      return;
    }
    setSelectedBusiness(item);
    setNewBusiness(false);
    setBusinessName(item.name);
    setMessage('Usaremos la ficha existente y la solicitud quedará pendiente de verificación.');
  }

  function chooseNew() {
    setSelectedBusiness(null);
    setNewBusiness(true);
    setMessage('Se recibirá como una ficha nueva pendiente de verificación.');
  }

  function detectServices() {
    if (!description.trim()) {
      setMessage('Describe en una frase lo que vendes o el servicio que prestas.');
      return;
    }
    const resolution = resolveServiceSuggestions(description.trim(), CHILE_LOCAL_SERVICE_SEED);
    const choices = resolution.suggestions.slice(0, 3);
    setServiceChoices(choices);
    setSelectedServiceIds(
      resolution.ambiguous
        ? []
        : choices.filter((item) => item.confidence !== 'low').map((item) => item.serviceId),
    );
    setMessage(
      choices.length
        ? 'Confirma solo las opciones que realmente corresponden a tu negocio.'
        : 'No pudimos clasificar este caso automáticamente. Usa el registro completo para terminarlo.',
    );
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function submit() {
    if (!point || !businessReady || !serviceReady || !contactReady) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitQuickBusinessRegistration({
        mode: selectedBusiness ? 'claim_existing' : 'create_new',
        ...(selectedBusiness ? { existingBusinessId: selectedBusiness.entity_id } : {}),
        businessName: businessName.trim(),
        ownerDescription: description.trim(),
        confirmedServiceIds: selectedServiceIds,
        anchorLocation: { lat: point.latitude, lng: point.longitude },
        contact: {
          ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        idempotencyKey: createClientMutationId(Date.now(), Math.random()),
      });

      router.replace(
        `/business/registration-received?registrationId=${encodeURIComponent(result.registration_id)}&businessName=${encodeURIComponent(businessName.trim())}&status=${encodeURIComponent(result.status)}`,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : 'registration_failed';
      const friendly: Record<string, string> = {
        invalid_api_key: 'No pudimos validar la conexión de Palta.',
        invalid_business_name: 'Revisa el nombre del negocio.',
        invalid_description: 'Describe brevemente lo que ofrece el negocio.',
        service_required: 'Confirma al menos un servicio.',
        invalid_location: 'No pudimos confirmar la ubicación del local.',
        contact_required: 'Agrega WhatsApp o teléfono.',
      };
      setMessage(friendly[code] ?? 'No pudimos enviar el registro. Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame
      title="Registra tu negocio"
      subtitle={`${progress} · Lo esencial ahora; el resto después`}
    >
      {step === 1 ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Primero buscamos tu local cerca de aquí para no duplicarlo.
          </Text>
          <Field
            value={businessName}
            onChangeText={(value) => {
              setBusinessName(value);
              setMatches([]);
              setSelectedBusiness(null);
              setNewBusiness(false);
            }}
            placeholder="Nombre del negocio"
          />
          <Button
            label={busy ? 'Buscando…' : point ? 'Buscar nuevamente cerca de mí' : 'Ubicar y buscar mi negocio'}
            onPress={() => void locateAndSearch()}
            disabled={busy || !businessName.trim()}
          />

          {matches.map((item) => (
            <Pressable
              key={item.entity_id}
              onPress={() => chooseExisting(item)}
              style={{
                marginTop: 10,
                padding: 14,
                borderRadius: 14,
                borderWidth: selectedBusiness?.entity_id === item.entity_id ? 2 : 1,
                borderColor: selectedBusiness?.entity_id === item.entity_id
                  ? paltaTheme.color.brandPrimary
                  : paltaTheme.color.divider,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                {item.name}
              </Text>
              <Text style={{ marginTop: 3, color: paltaTheme.color.textMuted }}>
                {item.distance_m !== undefined ? `${Math.round(item.distance_m)} m · ` : ''}
                {item.verification_status === 'verified' ? 'Verificado' : 'Ficha existente'}
              </Text>
            </Pressable>
          ))}

          {point ? (
            <Button label="No es ninguno · registrar uno nuevo" onPress={chooseNew} secondary />
          ) : null}
          <Button label="Continuar" onPress={() => setStep(2)} disabled={!businessReady} />
          <Button
            label="Marcar ubicación manualmente"
            onPress={() => router.push('/business/register')}
            secondary
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Escribe una frase simple. Por ejemplo: “panadería y cafetería” o “reparación de celulares”.
          </Text>
          <Field
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              setServiceChoices([]);
              setSelectedServiceIds([]);
            }}
            placeholder="¿Qué vendes o qué servicio prestas?"
            multiline
          />
          <Button label="Detectar servicios" onPress={detectServices} disabled={!description.trim()} />

          {serviceChoices.map((choice) => {
            const selected = selectedServiceIds.includes(choice.serviceId);
            return (
              <Pressable
                key={choice.serviceId}
                onPress={() => toggleService(choice.serviceId)}
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                  backgroundColor: paltaTheme.color.surface,
                }}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {selected ? '✓ ' : ''}{choice.label}
                </Text>
              </Pressable>
            );
          })}

          <Button label="Continuar" onPress={() => setStep(3)} disabled={!serviceReady} />
          <Button label="Volver" onPress={() => setStep(1)} secondary />
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Deja al menos un contacto del negocio. Palta lo usará para verificar al responsable antes de habilitar cambios sensibles.
          </Text>
          <Field value={whatsapp} onChangeText={setWhatsapp} placeholder="WhatsApp" phone />
          <Field value={phone} onChangeText={setPhone} placeholder="Teléfono (opcional)" phone />
          <Button
            label={busy ? 'Registrando…' : 'Registrar negocio'}
            onPress={() => void submit()}
            disabled={busy || !contactReady}
          />
          <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            El registro no activa cupones, promociones ni cambios sensibles automáticamente. Primero se verifica al propietario o administrador.
          </Text>
          <Button label="Volver" onPress={() => setStep(2)} secondary />
        </View>
      ) : null}

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ marginTop: 14, lineHeight: 21, color: paltaTheme.color.textMuted }}
        >
          {message}
        </Text>
      ) : null}
    </ScreenFrame>
  );
}
