import { useCallback } from 'react';
import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import type { NotificationApiItem } from '../../../../src/api/paltaApiClient';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SummaryListRow } from '../../components/home/SummaryListRow';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function navigateToTarget(target: string) {
  if (/^https?:\/\//i.test(target)) {
    await Linking.openURL(target);
    return;
  }
  router.push(target as never);
}

export default function NotificationsScreen() {
  const loadNotifications = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.getNotifications();
  }, []);

  const { state, refresh } = useAsyncResource(loadNotifications, {
    isEmpty: (value) => value.items.length === 0,
  });

  const openNotification = useCallback(
    async (item: NotificationApiItem) => {
      if (mobileRuntime.status !== 'ready') {
        throw new Error(mobileRuntime.message);
      }
      if (!item.read_at) {
        await mobileRuntime.client.markNotificationRead(item.id);
      }
      await navigateToTarget(item.target);
    },
    [],
  );

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Avisos">
        <LoadingState label="Cargando avisos…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Avisos">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const data = state.data;
  if (!data || data.items.length === 0) {
    return (
      <ScreenFrame title="Avisos">
        <EmptyState
          title="No tienes avisos pendientes"
          body="Cuando algo importante cambie, aparecerá aquí."
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Avisos">
      <View style={{ gap: 12 }}>
        <Text
          allowFontScaling
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: paltaTheme.color.textSecondary,
          }}
        >
          {data.summary.unread_count > 0
            ? `${data.summary.unread_count} sin leer`
            : 'Todo revisado'}
        </Text>

        <View>
          {data.items.map((item) => {
            const importance =
              item.importance === 'urgent'
                ? 'Urgente'
                : item.importance === 'important'
                  ? 'Importante'
                  : undefined;
            const created = timeLabel(item.created_at);
            const meta = [!item.read_at ? 'Nuevo' : undefined, importance, created]
              .filter(Boolean)
              .join(' · ');

            return (
              <SummaryListRow
                key={item.id}
                title={item.title}
                meta={meta || undefined}
                detail={item.body}
                explicitActionLabel="Ver"
                onPress={() => {
                  void openNotification(item).catch(() => {
                    void refresh();
                  });
                }}
              />
            );
          })}
        </View>

        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
