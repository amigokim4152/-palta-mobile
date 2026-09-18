import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { LocalSearchItem } from '../../../../src/api/paltaApiClient';
import { submitBusinessQuickRegistration } from '../../../../src/api/businessQuickRegistrationApiClient';
import { createClientMutationId } from '../../../../src/api/retryPolicy';
import { CHILE_LOCAL_SERVICE_SEED } from '../../../../src/business/chileServiceSeed';
import { resolveServiceSuggestions } from '../../../../src/business/serviceResolver';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { ScreenFrame } from '../../components/ScreenFrame';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

type Step = 'business' | 'service' | 'contact';
type Point = { latitude: number; longitude: number };
type ServiceChoice = {
  serviceId: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: readonly string[];
};

function normalizeChileContact(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (hasPlus) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith('56') && digits.length === 11) return `+${digits}`;
  if (digits.length === 9) return `+56${digits}`;
  return null;
}

function ActionButton({
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
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingHorizontal: 16,
        marginTop: 10,
        opacity: disabled ? 0.42 : 1,
        backgroundColor: secondary ? paltaTheme.color.surface : paltaTheme.color.brandPrimary,
        borderWidth: secondary ? 1 : 0,
        borderColor: paltaTheme.color.divider,
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

function Field({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize="sentences"
      style={{
        minHeight: multiline ? 92 : 52,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginTop: 10,
        backgroundColor: paltaTheme.color.surface,
        color: paltaTheme.color.textPrimary,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

export function BusinessQuickRegistrationScreen() {
  const startedAtMs = useRef(Date.now());
  const [step, setStep] = useState<Step>('business');
  const [businessName, setBusinessName] = useState('');
  const [point, setPoint] = useState<Point | null>(null);
  const [matches, setMatches] = useState<LocalSearchItem[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<LocalSearchItem | null>(null);
  const [newBusinessConfirmed, setNewBusinessConfirmed] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceChoices, setServiceChoices] = useState<ServiceChoice[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canContinueBusiness = Boolean(
    point && businessName.trim() && (selectedBusiness || newBusinessConfirmed),
  );
  const canContinueService = selectedServiceIds.length > 0;
  const canSubmit = Boolean(whatsapp.trim() || phone.trim());

  const stepLabel = useMemo(() => {
    if (step === 'business') return '1 de 3 · Tu negocio';
    if (step === 'service') return '2 de 3 · Qué ofreces';
    return '3 de 3 · Cómo contactarte';
  }, [step]);

  async function captureLocationAndSearch() {
    if (!businessName.trim()) {
      setMessage('Escribe primero el nombre del negocio.');
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
        setMessage('Para el registro rápido de un local físico necesitamos ubicar el negocio. Puedes usar el registro completo para marcarlo manualmente.');
        return;
      }

      const nextPoint = await expoLocationAdapter.getCurrentPosition();
      setPoint(nextPoint);
      const items = await mobileRuntime.client.searchLocal({
        latitude: nextPoint.latitude,
        longitude: nextPoint.longitude,
        radiusM: 1200,
        query: businessName.trim(),
      });
      const businesses = items.filter((item) => item.entity_type === 'business').slice(0, 4);
      setMatches(businesses);
      setSelectedBusiness(null);
      setNewBusinessConfirmed(businesses.length === 0);
      setMessage(
        businesses.length
          ? '¿Tu negocio ya aparece? Elígelo. Palta no creará una ficha duplicada.'
          : 'No encontramos una ficha cercana con ese nombre. Puedes continuar como negocio nuevo.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos buscar el negocio.');
    } finally {
      setBusy(false);
    }
  }

  function chooseMatch(item: LocalSearchItem) {
    setSelectedBusiness(item);
    setNewBusinessConfirmed(false);
    setBusinessName(item.name);
    setMessage(
      item.verification_status === 'claimed' || item.verification_status === 'verified'
        ? 'Esta ficha ya existe. Enviaremos una solicitud de verificación del responsable; no crearemos otra ficha.'
        : 'Usaremos esta ficha existente y pediremos la verificación del responsable.',
    );
  }

  function chooseNew() {
    setSelectedBusiness(null);
    setNewBusinessConfirmed(true);
    setMessage('Se enviará una ficha nueva pendiente de verificación.');
  }

  function continueToService() {
    if (!canContinueBusiness) return;
    setMessage(null);
    setStep('service');
  }

  function detectServices() {
    if (!description.trim()) {
      setMessage('Cuéntanos brevemente qué vendes o qué servicio prestas.');
      return;
    }
    const resolution = resolveServiceSuggestions(description, CHILE_LOCAL_SERVICE_SEED);
    const choices = resolution.suggestions.slice(0, 3);
    setServiceChoices(choices);
    setSelectedServiceIds(
      resolution.ambiguous
        ? []
        : choices.filter((item) => item.confidence !== 'low').map((item) => item.serviceId),
    );
    setMessage(
      choices.length
        ? 'Confirma las opciones que describen lo que realmente haces.'
        : 'No pudimos clasificarlo todavía. Usa el registro completo para terminar este caso.',
    );
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function continueToContact() {
    if (!canContinueService) return;
    setMessage(null);
    setStep('contact');
  }

  async function submit() {
    if (!point || !canSubmit || !canContinueService) return;
    if (mobileRuntime.status !== 'ready' || !mobileRuntime.publicApiKey) {
      setMessage('Palta todavía no tiene conexión pública configurada.');
      return;
    }

    const normalizedWhatsapp = whatsapp.trim() ? normalizeChileContact(whatsapp) : null;
    const normalizedPhone = phone.trim() ? normalizeChileContact(phone) : null;
    if (whatsapp.trim() && !normalizedWhatsapp) {
      setMessage('Revisa el WhatsApp. En Chile puedes escribirlo como 9XXXXXXXX o +56 9XXXXXXXX.');
      return;
    }
    if (phone.trim() && !normalizedPhone) {
      setMessage('Revisa el teléfono. Usa el número chileno completo o el formato +56.');
      return;
    }
    if (!normalizedWhatsapp && !normalizedPhone) {
      setMessage('Deja al menos un WhatsApp o teléfono válido.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const clientElapsedSeconds = Math.max(
        0,
        Math.min(3600, Math.round((Date.now() - startedAtMs.current) / 1000)),
      );
      const result = await submitBusinessQuickRegistration({
        baseUrl: mobileRuntime.apiBaseUrl,
        publicApiKey: mobileRuntime.publicApiKey,
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          return {
            ok: response.ok,
            status: response.status,
            json: () => response.json(),
          };
        },
        registration: {
          mode: selectedBusiness ? 'claim_existing' : 'create_new',
          ...(selectedBusiness ? { existingBusinessId: selectedBusiness.entity_id } : {}),
          businessName: businessName.trim(),
          ownerDescription: description.trim(),
          confirmedServiceIds: selectedServiceIds,
          anchorLocation: { lat: point.latitude, lng: point.longitude },
          contact: {
            ...(normalizedWhatsapp ? { whatsapp: normalizedWhatsapp } : {}),
            ...(normalizedPhone ? { phone: normalizedPhone } : {}),
          },
          idempotencyKey: createClientMutationId(Date.now(), Math.random()),
          clientElapsedSeconds,
        },
      });

      const receiptStatus = result.mode === 'claim_existing' ? 'matched_existing' : result.status;
      router.replace({
        pathname: '/business/registration-received',
        params: {
          registrationId: result.registration_id,
          businessName: businessName.trim(),
          status: receiptStatus,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos enviar el registro.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame
      title="Registra tu negocio"
      subtitle={`${stepLabel} · Lo básico ahora; fotos, horarios y promociones después`}
    >
      {step === 'business' ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Palta comprueba primero si tu negocio ya existe para evitar fichas duplicadas.
          </Text>
          <Field
            value={businessName}
            onChangeText={(value) => {
              setBusinessName(value);
              setMatches([]);
              setSelectedBusiness(null);
              setNewBusinessConfirmed(false);
            }}
            placeholder="Nombre del negocio"
          />
          <ActionButton
            label={busy ? 'Buscando cerca…' : point ? 'Buscar de nuevo cerca de mí' : 'Ubicar y buscar mi negocio'}
            onPress={() => void captureLocationAndSearch()}
            disabled={busy || !businessName.trim()}
          />

          {matches.map((item) => (
            <Pressable
              key={item.entity_id}
              onPress={() => chooseMatch(item)}
              style={{
                marginTop: 10,
                borderWidth: selectedBusiness?.entity_id === item.entity_id ? 2 : 1,
                borderColor:
                  selectedBusiness?.entity_id === item.entity_id
                    ? paltaTheme.color.brandPrimary
                    : paltaTheme.color.divider,
                borderRadius: 14,
                padding: 14,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                {item.name}
              </Text>
              <Text style={{ marginTop: 3, color: paltaTheme.color.textMuted }}>
                {item.verification_status === 'verified'
                  ? 'Negocio verificado · puedes solicitar acceso'
                  : item.verification_status === 'claimed'
                    ? 'Ficha administrada · puedes solicitar acceso'
                    : 'Ficha existente'}
              </Text>
            </Pressable>
          ))}

          {point ? (
            <ActionButton
              label="No es ninguno · agregar como negocio nuevo"
              onPress={chooseNew}
              secondary
            />
          ) : null}

          <ActionButton
            label="Continuar"
            onPress={continueToService}
            disabled={!canContinueBusiness}
          />
          <ActionButton
            label="Necesito marcar la ubicación manualmente"
            onPress={() => router.push('/business/register')}
            secondary
          />
        </View>
      ) : null}

      {step === 'service' ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Escríbelo como se lo dirías a un cliente. Ejemplo: “panadería y cafetería” o “reparación de celulares”.
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
          <ActionButton
            label="Detectar servicios"
            onPress={detectServices}
            disabled={!description.trim()}
          />

          {serviceChoices.map((item) => {
            const selected = selectedServiceIds.includes(item.serviceId);
            return (
              <Pressable
                key={item.serviceId}
                onPress={() => toggleService(item.serviceId)}
                style={{
                  marginTop: 10,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                  borderRadius: 14,
                  padding: 14,
                  backgroundColor: paltaTheme.color.surface,
                }}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {selected ? '✓ ' : ''}{item.label}
                </Text>
              </Pressable>
            );
          })}

          <ActionButton
            label="Continuar"
            onPress={continueToContact}
            disabled={!canContinueService}
          />
          <ActionButton label="Volver" onPress={() => setStep('business')} secondary />
        </View>
      ) : null}

      {step === 'contact' ? (
        <View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: paltaTheme.color.textMuted }}>
            Deja al menos un contacto. La ficha quedará pendiente hasta verificar al responsable del negocio.
          </Text>
          <Field
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="WhatsApp · ej. 9 1234 5678"
            keyboardType="phone-pad"
          />
          <Field
            value={phone}
            onChangeText={setPhone}
            placeholder="Teléfono (opcional si ya pusiste WhatsApp)"
            keyboardType="phone-pad"
          />
          <ActionButton
            label={busy ? 'Registrando…' : 'Enviar registro'}
            onPress={() => void submit()}
            disabled={busy || !canSubmit}
          />
          <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            Enviar el registro no activa automáticamente cupones, promociones ni cambios sensibles. Esas funciones se habilitan después de verificar al propietario o administrador.
          </Text>
          <ActionButton label="Volver" onPress={() => setStep('service')} secondary />
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
