import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import type {
  HomeApiResponse,
  ProfileApiResponse,
} from '../../../../src/api/paltaApiClient';
import {
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { PaltaButton } from '../../components/common/PaltaButton';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

type ContextData =
  | { kind: 'profile'; profile: ProfileApiResponse }
  | { kind: 'location'; home: HomeApiResponse };

function runtimeClient() {
  if (mobileRuntime.status !== 'ready') {
    throw new Error(mobileRuntime.message);
  }
  return mobileRuntime.client;
}

function ProfileContext({
  profile,
  onSaved,
}: {
  profile: ProfileApiResponse;
  onSaved: () => void;
}) {
  const [preferredName, setPreferredName] = useState(profile.preferred_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setPreferredName(profile.preferred_name ?? '');
  }, [profile.preferred_name]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await runtimeClient().updateProfile({
        preferred_name: preferredName.trim() || null,
      });
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <View>
        <Text
          allowFontScaling
          style={{
            fontSize: 13,
            lineHeight: 18,
            color: paltaTheme.color.textSecondary,
            marginBottom: 6,
          }}
        >
          Nombre preferido
        </Text>
        <TextInput
          value={preferredName}
          onChangeText={setPreferredName}
          placeholder="Cómo quieres que Palta te llame"
          autoCapitalize="words"
          returnKeyType="done"
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: paltaTheme.color.border,
            borderRadius: paltaTheme.radius.prominent,
            paddingHorizontal: 12,
            fontSize: 16,
            color: paltaTheme.color.textPrimary,
            backgroundColor: paltaTheme.color.surface,
          }}
        />
      </View>

      <View>
        <SummaryListRow
          title="Idioma"
          meta={profile.preferred_language}
        />
        <SummaryListRow
          title="Zona horaria"
          meta={profile.timezone}
        />
        {profile.country_code ? (
          <SummaryListRow title="País" meta={profile.country_code} />
        ) : null}
      </View>

      {saveError ? (
        <Text allowFontScaling style={{ color: paltaTheme.color.warning }}>
          {saveError}
        </Text>
      ) : null}

      <PaltaButton
        label="Guardar"
        loading={saving}
        onPress={() => void save()}
      />
    </View>
  );
}

function LocationContext({ home }: { home: HomeApiResponse }) {
  const locality = home.context?.locality.label ?? home.locality_label ?? 'Tu zona';

  return (
    <View style={{ gap: 18 }}>
      <View>
        <Text
          allowFontScaling
          style={{
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '700',
            color: paltaTheme.color.textPrimary,
          }}
        >
          {locality}
        </Text>
        <Text
          allowFontScaling
          style={{
            marginTop: 5,
            fontSize: 14,
            lineHeight: 20,
            color: paltaTheme.color.textSecondary,
          }}
        >
          Palta usa esta zona para priorizar información local, servicios y avisos que te pueden servir hoy.
        </Text>
      </View>

      <PaltaButton
        label="Ver Barrio"
        variant="secondary"
        onPress={() => router.push('/(tabs)/neighborhood')}
      />

      <Text
        allowFontScaling
        style={{
          fontSize: 13,
          lineHeight: 19,
          color: paltaTheme.color.textMuted,
        }}
      >
        Explorar otro lugar no cambia automáticamente tu zona habitual.
      </Text>
    </View>
  );
}

export default function ContextScreen() {
  const { contextId } = useLocalSearchParams<{ contextId: string }>();

  const loadContext = useCallback(async (): Promise<ContextData> => {
    const client = runtimeClient();
    if (contextId === 'profile') {
      return { kind: 'profile', profile: await client.getProfile() };
    }
    if (contextId === 'location') {
      return { kind: 'location', home: await client.getHome() };
    }
    throw new Error('Contexto no disponible.');
  }, [contextId]);

  const { state, refresh } = useAsyncResource(loadContext);

  const title = contextId === 'profile' ? 'Perfil' : 'Tu zona';

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title={title}>
        <LoadingState label="Cargando…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title={title}>
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const data = state.data;
  if (!data) {
    return (
      <ScreenFrame title={title}>
        <Text>No hay información disponible.</Text>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title={title}>
      {data.kind === 'profile' ? (
        <ProfileContext profile={data.profile} onSaved={() => void refresh()} />
      ) : (
        <LocationContext home={data.home} />
      )}

      {state.status === 'error' ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}
    </ScreenFrame>
  );
}
