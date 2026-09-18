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
import { paltaTheme } from '../../theme/paltaTheme';

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
      <View style={{ gap: paltaTheme.spacing.sm }}>
        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
            Aquí ves actualizaciones dentro de Palta. Seguir un negocio no activa por sí solo mensajes promocionales ni notificaciones fuera de esta pantalla.
          </Text>
        </View>

        {items.length === 0 ? (
          <EmptyState
            title="Todavía no sigues negocios"
            body="Cuando elijas seguir un negocio, sus novedades y beneficios vigentes podrán aparecer aquí."
          />
        ) : (
          items.map((item) => {
            const isBenefit = item.kind === 'coupon';
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${isBenefit ? 'Beneficio' : 'Novedad'} de ${item.business_name}: ${item.title}`}
                onPress={() => router.push(`/business/${encodeURIComponent(item.business_id)}`)}
                style={({ pressed }) => ({
                  padding: paltaTheme.spacing.md,
                  gap: paltaTheme.spacing.xs,
                  borderWidth: 1,
                  borderColor: isBenefit
                    ? paltaTheme.color.brandFresh
                    : paltaTheme.color.divider,
                  borderRadius: paltaTheme.radius.surface,
                  backgroundColor: pressed
                    ? paltaTheme.color.surfaceMuted
                    : isBenefit
                      ? paltaTheme.color.avocadoCream
                      : paltaTheme.color.surface,
                })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: paltaTheme.spacing.xs,
                  }}
                >
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      paddingHorizontal: paltaTheme.spacing.xs,
                      paddingVertical: paltaTheme.spacing.xxs,
                      borderRadius: paltaTheme.radius.pill,
                      backgroundColor: isBenefit
                        ? paltaTheme.color.brandSoft
                        : paltaTheme.color.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: isBenefit
                          ? paltaTheme.color.brandPrimary
                          : paltaTheme.color.textSecondary,
                      }}
                    >
                      {isBenefit ? 'BENEFICIO' : 'NOVEDAD'}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 12,
                      fontWeight: '700',
                      color: paltaTheme.color.textMuted,
                    }}
                  >
                    {item.business_name}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 17,
                    lineHeight: 22,
                    fontWeight: '800',
                    color: paltaTheme.color.textPrimary,
                  }}
                >
                  {item.title}
                </Text>
                {item.body ? (
                  <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                    {item.body}
                  </Text>
                ) : null}

                <View style={{ gap: paltaTheme.spacing.xxs }}>
                  <Text style={{ color: paltaTheme.color.textMuted, fontSize: 12 }}>
                    {new Date(item.occurred_at).toLocaleString('es-CL')}
                  </Text>
                  {item.expires_at ? (
                    <Text
                      style={{
                        color: isBenefit
                          ? paltaTheme.color.warning
                          : paltaTheme.color.textMuted,
                        fontSize: 12,
                        fontWeight: isBenefit ? '700' : '400',
                      }}
                    >
                      Vigente hasta {new Date(item.expires_at).toLocaleDateString('es-CL')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}

        {state.status === 'error' && state.data ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}