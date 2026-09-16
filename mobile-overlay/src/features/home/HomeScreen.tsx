import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { HomeCandidateCard } from '../../components/HomeCandidateCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { SectionHeading } from '../../components/common/SectionHeading';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { selectHomeDisplayItems } from '../../../../src/home/selectHomeDisplayItems';

function eyebrow(kind: string): string {
  if (kind === 'action' || kind === 'alert') return 'AHORA';
  if (kind === 'status') return 'EN CURSO';
  if (kind === 'content') return 'PARA HOY';
  return 'HOY';
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getHome();
  }, []);

  const { state, refresh } = useAsyncResource(loadHome, {
    isEmpty: (data) => data.items.length === 0,
  });

  const selection = useMemo(
    () => selectHomeDisplayItems(state.data?.items ?? []),
    [state.data?.items],
  );

  return (
    <ScreenFrame title="Palta" subtitle="Tu vida, más cerca">
      {state.status === 'loading' && !state.data ? (
        <LoadingState label="Actualizando tu día…" />
      ) : null}

      {state.status === 'error' && !state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState
          title="Nada urgente por ahora"
          body="Palta no necesita llenar la pantalla si no hay nada útil que mostrar."
        />
      ) : null}

      {selection.items.length > 0 ? (
        <View style={{ gap: 2 }}>
          <SectionHeading
            title="Para ti, ahora"
            subtitle="Primero lo que requiere atención; después lo que realmente ayuda hoy."
          />

          {selection.items
            .slice(
              0,
              adaptive.textScaleClass === 'accessibility'
                ? Math.min(selection.items.length, 4)
                : selection.items.length,
            )
            .map((item) => (
            <HomeCandidateCard
              key={item.id}
              eyebrow={eyebrow(item.kind)}
              title={item.title}
              body={item.body}
              actionLabel={
                item.care_track_id ? 'Ver seguimiento' : undefined
              }
              onPress={
                item.care_track_id
                  ? () =>
                      router.push(
                        `/care/${encodeURIComponent(item.care_track_id!)}`,
                      )
                  : undefined
              }
            />
          ))}

          {adaptive.textScaleClass === 'accessibility' &&
          selection.items.length > 4 ? (
            <Text
              allowFontScaling
              style={{
                paddingVertical: 14,
                fontWeight: '700',
              }}
            >
              Ver {selection.items.length - 4} más
            </Text>
          ) : null}

          {selection.showQuietEndState ? (
            <Text
              allowFontScaling
              style={{
                paddingVertical: 20,
                opacity: 0.55,
                fontSize: 13,
              }}
            >
              Eso es todo lo útil por ahora.
            </Text>
          ) : null}
        </View>
      ) : null}

      {state.status === 'error' && state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}
    </ScreenFrame>
  );
}
