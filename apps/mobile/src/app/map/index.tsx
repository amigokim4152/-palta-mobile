import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MapFeature } from '../../../../../src/adapters/mapCore';
import type { LocalSearchItem } from '../../../../../src/api/paltaApiClient';
import { distanceMeters } from '../../../../../src/local/businessSnapshot';
import { ScreenFrame } from '../../components/ScreenFrame';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import {
  SANTIAGO_MAP,
  deleteOfflineMap,
  downloadOfflineMap,
  getPreferredMapSource,
  hasOfflineMap,
} from '../../map/offlineMapManager';
import { createSantiagoMapStyle } from '../../map/santiagoMapStyle';
import { mobileRuntime } from '../../services/paltaClient';

// Public launch-center fallback only. This is intentionally not the user's home
// coordinate. A real device location can be supplied separately after permission.
const VITACURA_LAUNCH_CENTER = {
  latitude: -33.3842,
  longitude: -70.5742,
};

const SEARCH_RADIUS_M = 5000;
const RELOAD_DISTANCE_M = 650;
const VIEWPORT_DEBOUNCE_MS = 450;

export default function SharedMapScreen() {
  const [offline, setOffline] = useState(() => hasOfflineMap(SANTIAGO_MAP));
  const [downloading, setDownloading] = useState(false);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [localStatus, setLocalStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const lastLoadedCenter = useRef(VITACURA_LAUNCH_CENTER);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entityTypes = useRef(new Map<string, LocalSearchItem['entity_type']>());

  const mapStyle = useMemo(
    () => createSantiagoMapStyle(getPreferredMapSource(SANTIAGO_MAP)),
    [offline],
  );

  const loadLocalEntities = useCallback(
    async (center: { latitude: number; longitude: number }) => {
      if (mobileRuntime.status !== 'ready') {
        setLocalStatus('error');
        return;
      }

      setLocalStatus('loading');
      try {
        const items = await mobileRuntime.client.searchLocal({
          latitude: center.latitude,
          longitude: center.longitude,
          radiusM: SEARCH_RADIUS_M,
        });
        entityTypes.current = new Map(
          items.map((item) => [item.entity_id, item.entity_type]),
        );
        const nextFeatures: MapFeature[] = items
          .filter((item) => item.location)
          .map((item) => ({
            id: item.entity_id,
            entityType: item.entity_type,
            coordinate: {
              latitude: item.location!.lat,
              longitude: item.location!.lng,
            },
            title: item.name,
            ...(item.category_key ? { categoryKey: item.category_key } : {}),
          }));

        setFeatures(nextFeatures);
        lastLoadedCenter.current = center;
        setLocalStatus('ready');
      } catch {
        setLocalStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    void loadLocalEntities(VITACURA_LAUNCH_CENTER);
    return () => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
    };
  }, [loadLocalEntities]);

  const handleViewportChanged = useCallback(
    (
      center: { latitude: number; longitude: number },
      zoom: number,
      userInteraction: boolean,
    ) => {
      if (!userInteraction || zoom < 12) return;

      const moved = distanceMeters(
        {
          lat: lastLoadedCenter.current.latitude,
          lng: lastLoadedCenter.current.longitude,
        },
        { lat: center.latitude, lng: center.longitude },
      );
      if (moved < RELOAD_DISTANCE_M) return;

      if (viewportTimer.current) clearTimeout(viewportTimer.current);
      viewportTimer.current = setTimeout(() => {
        void loadLocalEntities(center);
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [loadLocalEntities],
  );

  function handleSelectEntity(entityId: string) {
    const entityType = entityTypes.current.get(entityId);
    if (entityType === 'place') {
      router.push(`/place/${encodeURIComponent(entityId)}`);
      return;
    }
    if (entityType === 'business') {
      router.push(`/business/${encodeURIComponent(entityId)}`);
      return;
    }
  }

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadOfflineMap(SANTIAGO_MAP);
      setOffline(true);
    } catch (error) {
      Alert.alert(
        'No se pudo descargar el mapa',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      );
    } finally {
      setDownloading(false);
    }
  }

  function handleDelete() {
    deleteOfflineMap(SANTIAGO_MAP);
    setOffline(false);
  }

  const localStatusText =
    localStatus === 'loading'
      ? 'Buscando lugares…'
      : localStatus === 'error'
        ? 'Lugares no disponibles temporalmente'
        : `${features.length} lugares cercanos`;

  return (
    <ScreenFrame title="Mapa" subtitle="Vitacura · Santiago" scroll={false}>
      <View style={styles.container}>
        <View style={styles.map}>
          <NeighborhoodMap
            mapStyle={JSON.stringify(mapStyle)}
            features={features}
            initialCenter={VITACURA_LAUNCH_CENTER}
            initialZoom={14}
            onSelectEntity={handleSelectEntity}
            onViewportChanged={handleViewportChanged}
          />
        </View>

        <View style={styles.offlineBar}>
          <View style={styles.offlineText}>
            <Text style={styles.title}>Mapa de Palta</Text>
            <Text style={styles.status}>
              {localStatusText}
              {' · '}
              {offline ? 'mapa sin conexión listo' : 'mapa online'}
            </Text>
          </View>

          {downloading ? (
            <ActivityIndicator />
          ) : (
            <Pressable
              onPress={offline ? handleDelete : handleDownload}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {offline ? 'Eliminar' : 'Descargar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  status: { marginTop: 2, fontSize: 12, opacity: 0.65 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
  },
  buttonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
});
