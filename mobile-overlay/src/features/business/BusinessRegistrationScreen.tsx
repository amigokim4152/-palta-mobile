import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { LocalSearchItem } from '../../../../src/api/paltaApiClient';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import { createClientMutationId } from '../../../../src/api/retryPolicy';
import {
  chooseExistingBusiness,
  confirmBusinessServices,
  createBusinessOnboardingDraft,
  describeBusinessServices,
  evaluateOnboardingReadiness,
  requestOwnerVerification,
  setBusinessPresence,
  setBusinessPublicContact,
  setServiceSuggestions,
  startNewBusiness,
  type BusinessPresenceMode,
} from '../../../../src/business/businessOnboarding';
import { CHILE_LOCAL_SERVICE_SEED } from '../../../../src/business/chileServiceSeed';
import { resolveServiceSuggestions } from '../../../../src/business/serviceResolver';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { ScreenFrame } from '../../components/ScreenFrame';
import { mobileRuntime } from '../../services/paltaClient';

const SANTIAGO_MANUAL_MAP_CENTER = {
  latitude: -33.4489,
  longitude: -70.6693,
} as const;

type LocationSource = 'gps' | 'manual_map' | null;

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 10, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function areaIds(value: string): string[] {
  return value.split(',').map((item) => item.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
}

export function BusinessRegistrationScreen() {
  const [draft, setDraft] = useState(() => createBusinessOnboardingDraft(`local-${Date.now()}`));
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [manualMapTouched, setManualMapTouched] = useState(false);
  const [name, setName] = useState('');
  const [results, setResults] = useState<LocalSearchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const businessResults = results.filter((item) => item.entity_type === 'business');
  const selected = businessResults.find((item) => item.entity_id === selectedId);
  const features = useMemo<MapFeature[]>(
    () => businessResults.map((item) => ({
      id: item.entity_id,
      entityType: 'business',
      coordinate: { latitude: item.location.lat, longitude: item.location.lng },
      title: item.name,
      ...(item.category_key ? { categoryKey: item.category_key } : {}),
      selected: item.entity_id === selectedId,
    })),
    [businessResults, selectedId],
  );

  const confirmedMapCenter =
    locationSource === 'manual_map' && !manualMapTouched
      ? null
      : mapCenter;

  async function locate() {
    setBusy(true);
    setMessage(null);
    try {
      let permission = await expoLocationAdapter.getPermission();
      if (permission !== 'granted_foreground') permission = await expoLocationAdapter.requestForegroundPermission();
      if (permission !== 'granted_foreground') {
        setMessage('No necesitas compartir tu GPS. Puedes ubicar la zona manualmente en el mapa.');
        return;
      }
      const next = await expoLocationAdapter.getCurrentPosition();
      setPoint(next);
      setMapCenter(next);
      setLocationSource('gps');
      setManualMapTouched(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos obtener la ubicación.');
    } finally {
      setBusy(false);
    }
  }

  function useManualMap() {
    setPoint(SANTIAGO_MANUAL_MAP_CENTER);
    setMapCenter(SANTIAGO_MANUAL_MAP_CENTER);
    setLocationSource('manual_map');
    setManualMapTouched(false);
    setMessage('Mueve el mapa a la zona del negocio. Para un servicio a domicilio u online puedes continuar sin fijar una dirección exacta.');
  }

  async function searchExisting() {
    const searchCenter = mapCenter ?? point;
    if (!searchCenter || mobileRuntime.status !== 'ready') return;
    if (locationSource === 'manual_map' && !manualMapTouched) {
      setMessage('Mueve primero el mapa a la zona donde está tu negocio para buscar duplicados cerca.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const items = await mobileRuntime.client.searchLocal({
        latitude: searchCenter.latitude,
        longitude: searchCenter.longitude,
        radiusM: 5000,
        ...(name.trim() ? { query: name.trim() } : {}),
      });
      const businesses = items.filter((item) => item.entity_type === 'business');
      setResults(businesses);
      if (businesses.length === 0) setMessage('No encontramos ese negocio cerca. Puedes agregarlo sin crear una ficha duplicada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos buscar negocios cercanos.');
    } finally {
      setBusy(false);
    }
  }

  function claimExisting() {
    if (!selected) return;
    try {
      setDraft((current) => chooseExistingBusiness(current, {
        businessId: selected.entity_id,
        name: selected.name,
        location: { lat: selected.location.lat, lng: selected.location.lng },
        alreadyClaimed: selected.verification_status === 'claimed' || selected.verification_status === 'verified',
      }));
      setMessage(null);
    } catch {
      setMessage('Este negocio ya está administrado. El acceso debe pasar por recuperación/verificación, no por un nuevo claim.');
    }
  }

  function createNew() {
    if (!name.trim()) return;
    setDraft((current) => startNewBusiness(current, {
      businessName: name,
      ...(confirmedMapCenter
        ? { anchorLocation: { lat: confirmedMapCenter.latitude, lng: confirmedMapCenter.longitude } }
        : {}),
    }));
    setMessage(null);
  }

  function classifyDescription() {
    const described = describeBusinessServices(draft, description);
    const resolution = resolveServiceSuggestions(description, CHILE_LOCAL_SERVICE_SEED);
    const withSuggestions = setServiceSuggestions(described, resolution.suggestions.map((item) => ({
      serviceId: item.serviceId,
      label: item.label,
      confidence: item.confidence,
      matchedTerms: item.matchedTerms,
    })));
    setDraft(withSuggestions);
    setSelectedServices(resolution.ambiguous ? [] : resolution.suggestions.filter((item) => item.confidence !== 'low').map((item) => item.serviceId));
    setMessage(resolution.suggestions.length === 0 ? 'Esta expresión queda en la cola de clasificación. Palta no la convertirá silenciosamente en otra actividad.' : null);
  }

  function confirmServicesStep() {
    try {
      setDraft((current) => confirmBusinessServices(current, selectedServices));
      setMessage(null);
    } catch {
      setMessage('Confirma al menos un servicio que realmente ofreces.');
    }
  }

  function setMode(mode: BusinessPresenceMode) {
    try {
      const areas = areaIds(serviceArea);
      setDraft((current) => setBusinessPresence(current, {
        presenceModes: [mode],
        ...(areas.length ? { serviceAreaIds: areas } : {}),
        ...(confirmedMapCenter
          ? { anchorLocation: { lat: confirmedMapCenter.latitude, lng: confirmedMapCenter.longitude } }
          : {}),
      }));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'service_area_required'
        ? 'Indica las comunas o zonas donde atiendes.'
        : 'Un local físico necesita una ubicación real. Vuelve y mueve el mapa hasta el punto correcto; no necesitas activar GPS.');
    }
  }

  function finishProfile() {
    const next = setBusinessPublicContact(draft, { phone, whatsapp });
    const readiness = evaluateOnboardingReadiness(next);
    setDraft(next);
    if (!readiness.readyForVerification) {
      setMessage(`Falta completar: ${readiness.missing.join(', ')}`);
      return;
    }
    setDraft(requestOwnerVerification(next));
    setMessage(null);
  }

  async function submitRegistration() {
    if (mobileRuntime.status !== 'ready') {
      setMessage('La conexión con Palta no está configurada.');
      return;
    }
    if (draft.mode === 'undecided' || !draft.businessName || !draft.ownerDescription) {
      setMessage('El registro aún no está completo.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await mobileRuntime.client.submitBusinessOnboarding({
        mode: draft.mode,
        ...(draft.businessId ? { businessId: draft.businessId } : {}),
        businessName: draft.businessName,
        ownerDescription: draft.ownerDescription,
        confirmedServiceIds: draft.confirmedServiceIds,
        presenceModes: draft.presenceModes,
        serviceAreaIds: draft.serviceAreaIds,
        ...(draft.anchorLocation ? { anchorLocation: draft.anchorLocation } : {}),
        ...(draft.addressLabel ? { addressLabel: draft.addressLabel } : {}),
        contact: draft.publicContact,
        idempotencyKey: createClientMutationId(Date.now(), Math.random()),
      });
      router.replace(`/business/manage/${encodeURIComponent(result.business_id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos enviar el registro.');
    } finally {
      setBusy(false);
    }
  }

  if (draft.stage === 'find_business') {
    return (
      <ScreenFrame title="Agrega tu negocio" subtitle="Primero evita duplicados: busca si ya aparece" scroll={false}>
        <View style={{ flex: 1 }}>
          {!point ? (
            <>
              <Button label={busy ? 'Buscando ubicación…' : 'Buscar cerca de mí'} onPress={() => void locate()} disabled={busy} />
              <Button label="Continuar sin GPS" onPress={useManualMap} disabled={busy} />
              <Text style={{ marginTop: 10, opacity: 0.64, lineHeight: 20 }}>
                El GPS es opcional. Si no lo usas, abre el mapa y muévelo a la zona del negocio. Los servicios a domicilio u online no necesitan publicar una dirección exacta.
              </Text>
            </>
          ) : (
            <>
              <TextInput value={name} onChangeText={setName} placeholder="Nombre del negocio" style={{ borderWidth: 1, borderRadius: 12, padding: 12 }} />
              <Button label={busy ? 'Buscando…' : 'Buscar negocio'} onPress={() => void searchExisting()} disabled={busy || !name.trim() || (locationSource === 'manual_map' && !manualMapTouched)} />
              {locationSource === 'manual_map' && !manualMapTouched ? (
                <Text style={{ marginTop: 8, opacity: 0.64 }}>
                  Mueve el mapa para buscar negocios existentes cerca. Si tu actividad no tiene local fijo, también puedes escribir el nombre y agregarla como nueva.
                </Text>
              ) : null}
              <View style={{ minHeight: 220, flex: 1, marginTop: 12 }}>
                {mobileRuntime.status === 'ready' && mobileRuntime.mapStyleUrl ? (
                  <NeighborhoodMap
                    mapStyle={mobileRuntime.mapStyleUrl}
                    features={features}
                    initialCenter={point}
                    onSelectEntity={setSelectedId}
                    onViewportChanged={(center, _zoom, userInteraction) => {
                      setMapCenter(center);
                      if (locationSource === 'manual_map' && userInteraction) {
                        setManualMapTouched(true);
                      }
                    }}
                  />
                ) : (
                  <View style={{ flex: 1, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Map Core preparado</Text></View>
                )}
              </View>
              {businessResults.slice(0, 5).map((item) => (
                <Pressable key={item.entity_id} onPress={() => setSelectedId(item.entity_id)} style={{ paddingVertical: 10 }}>
                  <Text style={{ fontWeight: item.entity_id === selectedId ? '800' : '600' }}>{item.name}</Text>
                </Pressable>
              ))}
              {selected ? <Button label="Este es mi negocio" onPress={claimExisting} /> : null}
              <Button label="No aparece · agregar nuevo" onPress={createNew} disabled={!name.trim()} />
            </>
          )}
          {message ? <Text style={{ marginTop: 10, opacity: 0.7 }}>{message}</Text> : null}
        </View>
      </ScreenFrame>
    );
  }

  if (draft.stage === 'describe_services') {
    return (
      <ScreenFrame title={draft.businessName ?? 'Tu negocio'} subtitle="¿Qué haces o vendes?">
        <TextInput value={description} onChangeText={setDescription} multiline placeholder="Escríbelo como se lo dirías a un cliente" style={{ minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' }} />
        <Button label="Continuar" onPress={classifyDescription} disabled={!description.trim()} />
        {message ? <Text style={{ marginTop: 10 }}>{message}</Text> : null}
      </ScreenFrame>
    );
  }

  if (draft.stage === 'confirm_services') {
    return (
      <ScreenFrame title="Confirma tus servicios" subtitle="Palta mantiene la clasificación interna; tú confirmas lo que realmente haces">
        {draft.serviceSuggestions.map((item) => {
          const active = selectedServices.includes(item.serviceId);
          return (
            <Pressable key={item.serviceId} onPress={() => setSelectedServices((current) => active ? current.filter((id) => id !== item.serviceId) : [...current, item.serviceId])} style={{ borderWidth: active ? 2 : 1, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <Text style={{ fontWeight: '700' }}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Button label="Confirmar" onPress={confirmServicesStep} disabled={!selectedServices.length} />
        {message ? <Text style={{ marginTop: 10 }}>{message}</Text> : null}
      </ScreenFrame>
    );
  }

  if (draft.stage === 'service_mode') {
    return (
      <ScreenFrame title="¿Cómo atiendes?" subtitle="Esto decide si mostramos un punto, un área de servicio o una sesión móvil">
        <TextInput value={serviceArea} onChangeText={setServiceArea} placeholder="Zonas donde atiendes: Vitacura, Las Condes…" style={{ borderWidth: 1, borderRadius: 12, padding: 12 }} />
        <Button label="Tengo un local físico" onPress={() => setMode('storefront')} />
        <Button label="Voy donde el cliente" onPress={() => setMode('customer_site')} />
        <Button label="Trabajo móvil / ferias / eventos" onPress={() => setMode('mobile_event')} />
        <Button label="Atiendo online" onPress={() => setMode('online')} />
        <Button label="Combino varias formas" onPress={() => setMode('mixed')} />
        {message ? <Text style={{ marginTop: 10 }}>{message}</Text> : null}
      </ScreenFrame>
    );
  }

  if (draft.stage === 'public_profile') {
    return (
      <ScreenFrame title="Datos básicos" subtitle="Fotos, horarios y catálogo pueden completarse después">
        <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Teléfono (opcional)" style={{ borderWidth: 1, borderRadius: 12, padding: 12 }} />
        <TextInput value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="WhatsApp (opcional)" style={{ borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 }} />
        <Button label="Continuar a verificación" onPress={finishProfile} />
        {message ? <Text style={{ marginTop: 10 }}>{message}</Text> : null}
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Confirma el registro" subtitle="La propiedad y los controles sensibles se verifican después">
      <Text>
        Palta guardará el negocio con estado de claim pendiente. La verificación de propietario/administrador se completa antes de activar cambios sensibles o beneficios publicados por el propietario.
      </Text>
      <Button label={busy ? 'Enviando…' : 'Enviar registro'} onPress={() => void submitRegistration()} disabled={busy} />
      {message ? <Text style={{ marginTop: 10, opacity: 0.7 }}>{message}</Text> : null}
    </ScreenFrame>
  );
}
