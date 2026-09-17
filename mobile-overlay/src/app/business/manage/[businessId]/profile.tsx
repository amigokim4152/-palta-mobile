import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

export default function BusinessOwnerProfileScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.ownerProfile.getOwnerProfile(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);

  useEffect(() => {
    const profile = state.data;
    if (!profile || initializedFor === profile.business_id) return;
    setDescription(profile.description ?? '');
    setPhone(profile.contact.phone ?? '');
    setWhatsapp(profile.contact.whatsapp ?? '');
    setInitializedFor(profile.business_id);
  }, [state.data, initializedFor]);

  async function save() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await mobileRuntime.client.ownerProfile.updateOwnerProfile(businessId, {
        description,
        phone,
        whatsapp,
      });
      setDescription(updated.description ?? '');
      setPhone(updated.contact.phone ?? '');
      setWhatsapp(updated.contact.whatsapp ?? '');
      setMessage('Información básica actualizada. El perfil público usará estos mismos datos.');
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos guardar: ${error.message}`
          : 'No pudimos guardar los cambios.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Información básica">
        <LoadingState label="Cargando información…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Información básica">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Información básica"
      subtitle="Datos públicos que puedes mantener gratis"
    >
      <View style={{ gap: 14 }}>
        <Text style={{ opacity: 0.68, lineHeight: 20 }}>
          Aquí puedes corregir tu descripción y formas de contacto. El nombre, la clasificación, los servicios y la ubicación usan controles propios para no romper la identidad, la búsqueda ni el mapa del negocio.
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '800' }}>Descripción</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1200}
            placeholder="Explica brevemente qué haces y qué puede encontrar una persona aquí"
            style={{
              minHeight: 120,
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
              textAlignVertical: 'top',
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '800' }}>Teléfono</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            maxLength={80}
            keyboardType="phone-pad"
            placeholder="Ej. +56 2 2345 6789"
            style={{ borderWidth: 1, borderRadius: 14, padding: 12 }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '800' }}>WhatsApp</Text>
          <TextInput
            value={whatsapp}
            onChangeText={setWhatsapp}
            maxLength={80}
            keyboardType="phone-pad"
            placeholder="Ej. +56 9 1234 5678"
            style={{ borderWidth: 1, borderRadius: 14, padding: 12 }}
          />
        </View>

        <Text style={{ fontSize: 12, opacity: 0.58, lineHeight: 18 }}>
          Dejar un teléfono o WhatsApp vacío lo elimina del perfil público. No conectamos una API externa para guardar estos datos.
        </Text>

        <Pressable
          disabled={saving}
          onPress={() => void save()}
          style={{ borderWidth: 1, borderRadius: 14, padding: 14, opacity: saving ? 0.5 : 1 }}
        >
          <Text style={{ fontWeight: '800', textAlign: 'center' }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Text>
        </Pressable>

        {message ? <Text style={{ opacity: 0.72, lineHeight: 20 }}>{message}</Text> : null}

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
