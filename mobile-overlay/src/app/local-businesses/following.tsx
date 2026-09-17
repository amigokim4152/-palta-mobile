import { useCallback } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';

export default function FollowedBusinessesScreen() {
  const load = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getFollowedBusinessUpdates();
  }, []);

  const { state, refresh } = useAsyncResource(load, {
    isEmpty: (response) => response.items.length === 0,
  });

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Siguiendo">
        <LoadingState label="Cargando novedades…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Siguiendo">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const items = state.data?.items ?? [];

  return (
    <ScreenFrame
      title="Siguiendo"
      subtitle="Novedades y beneficios de negocios que elegiste seguir"
    >
      <View style={{ gap: 12 }}>
        <Text style={{ opacity: 0.64, lineHeight: 20 }}>
          Aquí ves actualizaciones dentro de Palta. Seguir un negocio no activa por sí solo mensajes promocionales ni notificaciones fuera de esta pantalla.
        </Text>

        {items.length === 0 ? (
          <EmptyState
            title="Todavía no sigues negocios"
            body="Cuando elijas seguir un negocio, sus novedades y beneficios vigentes podrán aparecer aquí."
          />
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/business/${encodeURIComponent(item.business_id)}`)}
              style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.56 }}>
                {item.kind === 'coupon' ? 'BENEFICIO' : 'NOVEDAD'} · {item.business_name}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '800' }}>{item.title}</Text>
              {item.body ? <Text style={{ lineHeight: 20 }}>{item.body}</Text> : null}
              <Text style={{ opacity: 0.52, fontSize: 12 }}>
                {new Date(item.occurred_at).toLocaleString('es-CL')}
              </Text>
              {item.expires_at ? (
                <Text style={{ opacity: 0.58, fontSize: 12 }}>
                  Vigente hasta {new Date(item.expires_at).toLocaleDateString('es-CL')}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}

        {state.status === 'error' && state.data ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
