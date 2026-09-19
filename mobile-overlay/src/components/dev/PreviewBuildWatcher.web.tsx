import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const PREVIEW_ENABLED = process.env.EXPO_PUBLIC_PALTA_PREVIEW === '1' &&
  process.env.EXPO_PUBLIC_ENV !== 'production';
const CURRENT_BUILD_ID = process.env.EXPO_PUBLIC_PALTA_BUILD_SHA ?? 'local';
const RAW_BASE_URL =
  process.env.EXPO_PUBLIC_PALTA_WEB_BASE_URL ?? process.env.EXPO_BASE_URL ?? '';
const BASE_URL = RAW_BASE_URL === '/' ? '' : RAW_BASE_URL.replace(/\/$/, '');
const BUILD_URL = `${BASE_URL}/build.json`;
const POLL_INTERVAL_MS = 15_000;

function reloadIntoBuild(buildId: string) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('__palta_build', buildId);
  window.location.replace(nextUrl.toString());
}

export function PreviewBuildWatcher() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!PREVIEW_ENABLED || typeof window === 'undefined') return undefined;

    let disposed = false;
    let checking = false;

    const checkBuild = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const response = await fetch(`${BUILD_URL}?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { buildId?: unknown };
        const remoteBuildId =
          typeof payload.buildId === 'string' ? payload.buildId.trim() : '';
        if (!remoteBuildId || remoteBuildId === CURRENT_BUILD_ID) return;

        const reloadKey = `palta:preview:reload:${remoteBuildId}`;
        if (window.sessionStorage.getItem(reloadKey) === '1') return;

        window.sessionStorage.setItem(reloadKey, '1');
        setUpdating(true);
        window.setTimeout(() => reloadIntoBuild(remoteBuildId), 120);
      } catch {
        // Preview polling must never make the application unusable offline.
      } finally {
        checking = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkBuild();
    };
    const onFocus = () => void checkBuild();

    void checkBuild();
    const interval = window.setInterval(() => void checkBuild(), POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!PREVIEW_ENABLED) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{
        position: 'fixed' as never,
        right: 8,
        bottom: 76,
        zIndex: 9999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(35, 48, 39, 0.78)',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
        {updating ? 'Actualizando…' : `DEV ${CURRENT_BUILD_ID.slice(0, 8)}`}
      </Text>
    </View>
  );
}
