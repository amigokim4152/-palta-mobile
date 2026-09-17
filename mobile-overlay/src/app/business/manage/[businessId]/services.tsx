import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';
import { CHILE_LOCAL_SERVICE_SEED } from '../../../../../../src/business/chileServiceSeed';
import { suggestBusinessServices } from '../../../../../../src/business/businessServiceProfile';

export default function BusinessOwnerServicesScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [ownerWords, setOwnerWords] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.services.getOwnerServices(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);
  const profile = state.data;
  const currentIds = profile?.items.map((item) => item.service_id) ?? [];
  const currentGroups = profile?.items.map((item) => item.discovery_group_key) ?? [];

  const suggestions = useMemo(
    () => ownerWords.trim().length >= 2
      ? suggestBusinessServices(ownerWords, CHILE_LOCAL_SERVICE_SEED, currentGroups)
          .filter((item) => !currentIds.includes(item.serviceId))
      : [],
    [ownerWords, currentGroups.join('|'), currentIds.join('|')],
  );

  async function saveServices(canonicalServiceIds: string[], pendingOwnerPhrases: string[]) {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.services.updateOwnerServices(businessId, {
        canonicalServiceIds,
        pendingOwnerPhrases,
      });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar los servicios.');
    } finally {
      setSaving(false);
    }
  }

  async function addService(serviceId: string) {
    if (!profile) return;
    await saveServices(
      [...new Set([...currentIds, serviceId])],
      profile.pending_owner_phrases,
    );
    setOwnerWords('');
    setMessage('Servicio agregado al perfil.');
  }

  async function removeService(serviceId: string) {
    if (!profile) return;
    await saveServices(
      currentIds.filter((id) => id !== serviceId),
      profile.pending_owner_phrases,
    );
  }

  async function keepPendingPhrase() {
    if (!profile) return;
    const phrase = ownerWords.trim().replace(/\s+/g, ' ');
    if (!phrase) return;
    await saveServices(
      currentIds,
      [...new Set([...profile.pending_owner_phrases, phrase])].slice(0, 5),
    );
    setOwnerWords('');
    setMessage('Guardamos la forma en que describes este servicio. No se convertirá en una categoría de búsqueda hasta que esté clasificada.');
  }

  async function removePendingPhrase(phrase: string) {
    if (!profile) return;
    await saveServices(
      currentIds,
      profile.pending_owner_phrases.filter((item) => item !== phrase),
    );
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Servicios">
        <LoadingState label="Cargando servicios…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Servicios">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!profile) return null;

  return (
    <ScreenFrame title="Servicios" subtitle="Lo que haces, explicado de forma simple">
      <View style={{ gap: 16 }}>
        <Text style={{ opacity: 0.68, lineHeight: 20 }}>
          Escribe como se lo explicarías a un cliente. Palta te mostrará pocas opciones para confirmar; no necesitas navegar una lista enorme de categorías.
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '800' }}>Servicios actuales</Text>
          {profile.items.length ? profile.items.map((item) => (
            <View key={item.service_id} style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 }}>
              <Text style={{ fontWeight: '800' }}>{item.label}</Text>
              <Pressable disabled={saving} onPress={() => void removeService(item.service_id)}>
                <Text style={{ fontWeight: '700', opacity: 0.64 }}>Quitar</Text>
              </Pressable>
            </View>
          )) : (
            <Text style={{ opacity: 0.62 }}>Todavía no hay servicios confirmados.</Text>
          )}
        </View>

        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>¿Qué haces o qué vendes?</Text>
          <TextInput
            value={ownerWords}
            onChangeText={setOwnerWords}
            maxLength={120}
            placeholder="Ej.: destapo cañerías y reparo fugas de agua"
            style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}
          />
        </View>

        {suggestions.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '800' }}>¿Te refieres a esto?</Text>
            {suggestions.map((item) => (
              <Pressable
                key={item.serviceId}
                disabled={saving}
                onPress={() => void addService(item.serviceId)}
                style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 4, opacity: saving ? 0.5 : 1 }}
              >
                <Text style={{ fontWeight: '800' }}>{item.label}</Text>
                <Text style={{ fontSize: 12, opacity: 0.58 }}>Agregar este servicio</Text>
              </Pressable>
            ))}
          </View>
        ) : ownerWords.trim().length >= 2 ? (
          <View style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }}>
            <Text style={{ fontWeight: '800' }}>No encontramos una coincidencia clara</Text>
            <Text style={{ opacity: 0.65, lineHeight: 20 }}>
              Puedes guardar tus propias palabras para que Palta las clasifique después. No las convertiremos automáticamente en una categoría de búsqueda.
            </Text>
            <Pressable disabled={saving} onPress={() => void keepPendingPhrase()}>
              <Text style={{ fontWeight: '800' }}>Guardar esta descripción</Text>
            </Pressable>
          </View>
        ) : null}

        {profile.pending_owner_phrases.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '800' }}>Por clasificar</Text>
            {profile.pending_owner_phrases.map((phrase) => (
              <View key={phrase} style={{ borderWidth: 1, borderRadius: 12, padding: 12, gap: 5 }}>
                <Text>{phrase}</Text>
                <Pressable disabled={saving} onPress={() => void removePendingPhrase(phrase)}>
                  <Text style={{ fontWeight: '700', opacity: 0.64 }}>Quitar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={{ fontSize: 12, opacity: 0.58, lineHeight: 18 }}>
          Los servicios confirmados alimentan el mismo perfil público y la búsqueda local. No se crea una segunda ficha del negocio.
        </Text>
        {message ? <Text style={{ opacity: 0.72, lineHeight: 20 }}>{message}</Text> : null}
        {state.status === 'error' ? <ErrorState message={state.message} onRetry={() => void refresh()} /> : null}
      </View>
    </ScreenFrame>
  );
}
