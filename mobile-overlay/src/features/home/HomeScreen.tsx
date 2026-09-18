import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAdaptiveExperience } from '../../accessibility/useAdaptiveExperience';
import { HomeCandidateCard } from '../../components/HomeCandidateCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';
import { selectHomeDisplayItems } from '../../../../src/home/selectHomeDisplayItems';

function eyebrow(kind: string, sourceDomain: string): string {
  if (kind === 'action' || kind === 'alert') return 'Ahora';
  if (kind === 'status') return 'En curso';
  if (sourceDomain === 'community') return 'Tu comunidad';
  if (sourceDomain === 'local' || sourceDomain === 'business') return 'Cerca de ti';
  if (sourceDomain === 'transport') return 'Tu trayecto';
  if (kind === 'content') return 'Para hoy';
  return 'Hoy';
}

function HeaderAction() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buscar"
      onPress={() => router.push('/search')}
      style={{
        minWidth: paltaTheme.touch.minimum,
        minHeight: paltaTheme.touch.minimum,
        borderRadius: paltaTheme.radius.pill,
        backgroundColor: paltaTheme.color.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.sm,
      }}
    >
      <Text style={{ color: paltaTheme.color.textPrimary, fontSize: 14, fontWeight: '700' }}>Buscar</Text>
    </Pressable>
  );
}

function ContextBar() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: paltaTheme.spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver contexto de Santiago"
        onPress={() => router.push('/context/santiago')}
        style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center' }}
      >
        <Text style={{ color: paltaTheme.color.textMuted, fontSize: 12, fontWeight: '700' }}>TU ZONA</Text>
        <Text style={{ marginTop: 2, color: paltaTheme.color.textPrimary, fontSize: 16, fontWeight: '700' }}>Santiago</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver barrio"
        onPress={() => router.push('/(tabs)/neighborhood')}
        style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center', paddingHorizontal: paltaTheme.spacing.sm }}
      >
        <Text style={{ color: paltaTheme.color.brandPrimary, fontSize: 14, fontWeight: '700' }}>Ver barrio</Text>
      </Pressable>
    </View>
  );
}

export function HomeScreen() {
  const adaptive = useAdaptiveExperience();
  const loadHome = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getHome();
  }, []);

  const { state, refresh } = useAsyncResource(loadHome, { isEmpty: (data) => data.items.length === 0 });
  const selection = useMemo(() => selectHomeDisplayItems(state.data?.items ?? []), [state.data?.items]);
  const visibleItems = selection.items.slice(0, adaptive.textScaleClass === 'accessibility' ? 4 : selection.items.length);

  return (
    <ScreenFrame title="Palta" subtitle="Lo que importa, cerca de ti" action={<HeaderAction />}>
      <ContextBar />

      {state.status === 'loading' && !state.data ? <LoadingState label="Preparando tu día…" /> : null}
      {state.status === 'error' && !state.data ? <ErrorState message={state.message} onRetry={() => void refresh()} /> : null}

      {state.status === 'empty' ? (
        <View>
          <Text allowFontScaling style={{ color: paltaTheme.color.textPrimary, fontSize: 22, lineHeight: 29, fontWeight: '700' }}>
            Todo tranquilo por ahora.
          </Text>
          <Text allowFontScaling style={{ marginTop: 6, color: paltaTheme.color.textSecondary, fontSize: 15, lineHeight: 22 }}>
            Cuando haya algo que preparar, resolver o recordar, aparecerá aquí.
          </Text>
          <View style={{ marginTop: paltaTheme.spacing.xl }}>
            <EmptyState title="Sin pendientes" body="Puedes seguir explorando tu barrio y tus comunidades." />
          </View>
        </View>
      ) : null}

      {visibleItems.length > 0 ? (
        <View>
          <View style={{ paddingBottom: paltaTheme.spacing.xs }}>
            <Text allowFontScaling style={{ color: paltaTheme.color.textPrimary, fontSize: 22, lineHeight: 29, fontWeight: '700' }}>
              Para ti, ahora
            </Text>
            <Text allowFontScaling style={{ marginTop: 4, color: paltaTheme.color.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Lo importante primero. Sin llenar la pantalla por llenar.
            </Text>
          </View>

          {visibleItems.map((item) => (
            <HomeCandidateCard
              key={item.id}
              eyebrow={eyebrow(item.kind, item.source_domain)}
              title={item.title}
              body={item.body}
              actionLabel={item.care_track_id ? 'Ver seguimiento' : undefined}
              onPress={item.care_track_id ? () => router.push(`/care/${encodeURIComponent(item.care_track_id!)}`) : undefined}
            />
          ))}

          {adaptive.textScaleClass === 'accessibility' && selection.items.length > 4 ? (
            <Text allowFontScaling style={{ paddingVertical: 14, color: paltaTheme.color.brandPrimary, fontWeight: '700' }}>
              Ver {selection.items.length - 4} más
            </Text>
          ) : null}

          {selection.showQuietEndState ? (
            <View style={{ paddingVertical: paltaTheme.spacing.xl }}>
              <Text allowFontScaling style={{ color: paltaTheme.color.textMuted, fontSize: 13 }}>Eso es todo lo útil por ahora.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/neighborhood')}
                style={{ minHeight: paltaTheme.touch.minimum, justifyContent: 'center', alignSelf: 'flex-start' }}
              >
                <Text style={{ color: paltaTheme.color.brandPrimary, fontSize: 14, fontWeight: '700' }}>Explorar cerca de mí</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {state.status === 'error' && state.data ? <ErrorState message={state.message} onRetry={() => void refresh()} /> : null}
    </ScreenFrame>
  );
}
