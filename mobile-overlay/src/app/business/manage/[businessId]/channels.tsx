import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { BusinessPublicChannelProvider } from '../../../../../../src/api/paltaApiClient';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { SectionHeading } from '../../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

type EditableProvider = Extract<
  BusinessPublicChannelProvider,
  'instagram' | 'facebook' | 'tiktok' | 'google_business' | 'whatsapp' | 'website'
>;

type Field = {
  provider: EditableProvider;
  label: string;
  placeholder: string;
};

const fields: readonly Field[] = [
  { provider: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tu-negocio' },
  { provider: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/tu-negocio' },
  { provider: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@tu-negocio' },
  { provider: 'google_business', label: 'Google / Maps', placeholder: 'https://maps.google.com/...' },
  { provider: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/56...' },
  { provider: 'website', label: 'Sitio web', placeholder: 'https://tu-negocio.cl' },
];

function emptyValues(): Record<EditableProvider, string> {
  return {
    instagram: '',
    facebook: '',
    tiktok: '',
    google_business: '',
    whatsapp: '',
    website: '',
  };
}

export default function BusinessPublicChannelsScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [values, setValues] = useState<Record<EditableProvider, string>>(emptyValues);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBusiness(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadBusiness);
  const business = state.data;

  useEffect(() => {
    if (!business || initializedFor === business.id) return;
    const next = emptyValues();
    for (const link of business.channel_links ?? []) {
      if (link.provider in next) {
        next[link.provider as EditableProvider] = link.url;
      }
    }
    setValues(next);
    setInitializedFor(business.id);
  }, [business, initializedFor]);

  const nonEmptyCount = useMemo(
    () => Object.values(values).filter((value) => value.trim()).length,
    [values],
  );

  async function save() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      const links = fields
        .map((field) => ({
          provider: field.provider,
          url: values[field.provider].trim(),
        }))
        .filter((link) => link.url.length > 0);

      await mobileRuntime.client.replaceBusinessPublicChannelLinks(businessId, links);
      setMessage('Tus enlaces públicos quedaron guardados.');
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No se pudieron guardar: ${error.message}`
          : 'No se pudieron guardar los enlaces.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !business) {
    return (
      <ScreenFrame title="Enlaces públicos">
        <LoadingState label="Cargando enlaces…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !business) {
    return (
      <ScreenFrame title="Enlaces públicos">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Enlaces públicos"
      subtitle={business?.name}
      action={
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Volver</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Gratis, simple y sin conectar cuentas</Text>
          <Text style={{ opacity: 0.68, lineHeight: 21 }}>
            Agrega sólo los enlaces públicos que ya usas. Palta no inicia sesión, no publica y no administra estas cuentas desde esta función.
          </Text>
        </View>

        <SectionHeading
          title="Dónde más te pueden encontrar"
          subtitle={`${nonEmptyCount} enlace${nonEmptyCount === 1 ? '' : 's'} agregado${nonEmptyCount === 1 ? '' : 's'}`}
        />

        {fields.map((field) => (
          <View key={field.provider} style={{ gap: 6 }}>
            <Text style={{ fontWeight: '700' }}>{field.label}</Text>
            <TextInput
              value={values[field.provider]}
              onChangeText={(value) =>
                setValues((current) => ({ ...current, [field.provider]: value }))
              }
              placeholder={field.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 11,
              }}
            />
          </View>
        ))}

        <Text style={{ opacity: 0.6, lineHeight: 20 }}>
          Para automatizar publicaciones o administrar canales desde Palta se necesita una integración separada. Esa automatización no forma parte de los enlaces gratuitos.
        </Text>

        <Pressable
          disabled={saving}
          onPress={() => void save()}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            opacity: saving ? 0.55 : 1,
          }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {saving ? 'Guardando…' : 'Guardar enlaces'}
          </Text>
        </Pressable>

        {message ? <Text style={{ opacity: 0.72 }}>{message}</Text> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
