import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { LocalResultCard } from '../../components/LocalResultCard';
import { FilterChip } from '../../components/common/FilterChip';
import { MapResultSheet } from '../../components/neighborhood/MapResultSheet';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';

const DEVELOPMENT_LOCATION = {
  latitude: -33.3908,
  longitude: -70.5707,
};

function formatDistance(distanceM?: number): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

export function NeighborhoodScreen() {
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const searchPoint =
    neighborhood.searchOrigin ?? neighborhood.effectiveLocation;

  const loadResults = useCallback(async () => {
    if (!searchPoint) return [];
    if (mobileRuntime.status !== 'ready') {
      throw new Error(mobileRuntime.message);
    }
    return mobileRuntime.client.searchLocal({
      latitude: searchPoint.latitude,
      longitude: searchPoint.longitude,
      query: neighborhood.query || undefined,
    });
  }, [
    searchPoint?.latitude,
    searchPoint?.longitude,
    neighborhood.query,
  ]);

  const { state, refresh } = useAsyncResource(loadResults, {
    enabled: searchPoint !== null,
    isEmpty: (items) => items.length === 0,
  });

  const visibleResults = useMemo(
    () =>
      (state.data ?? []).filter((item) => {
        if (
          neighborhood.activeFilters.includes('verified') &&
          item.verification_status !== 'verified'
        ) {
          return false;
        }
        return true;
      }),
    [state.data, neighborhood.activeFilters],
  );

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      visibleResults.map((item) => ({
        id: item.entity_id,
        entityType: item.entity_type,
        coordinate: {
          latitude: item.location.lat,
          longitude: item.location.lng,
        },
        title: item.name,
        ...(item.category_key ? { categoryKey: item.category_key } : {}),
        selected: item.entity_id === neighborhood.selectedEntityId,
      })),
    [visibleResults, neighborhood.selectedEntityId],
  );

  async function useMyLocation() {
    setLocationBusy(true);
    setLocationError(null);
    try {
      let permission = await expoLocationAdapter.getPermission();
      if (permission !== 'granted_foreground') {
        permission = await expoLocationAdapter.requestForegroundPermission();
      }
      if (permission !== 'granted_foreground') {
        setLocationError(
          permission === 'restricted'
            ? 'Activa la ubicación para Palta desde Ajustes.'
            : 'Sin permiso de ubicación puedes explorar otra zona manualmente.',
        );
        return;
      }

      const point = await expoLocationAdapter.getCurrentPosition();
      dispatch({ type: 'set_effective_location', location: point });
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : 'No pudimos obtener tu ubicación.',
      );
    } finally {
      setLocationBusy(false);
    }
  }

  function openEntity(entityId: string, entityType: string) {
    dispatch({ type: 'select_entity', entityId });
    if (entityType === 'business') {
      router.push(`/business/${encodeURIComponent(entityId)}`);
    } else {
      router.push(`/place/${encodeURIComponent(entityId)}`);
    }
  }

  if (!neighborhood.effectiveLocation) {
    return (
      <ScreenFrame
        title="Tu barrio"
        subtitle="La ubicación se usa sólo cuando hace falta"
      >
        <Text style={{ fontSize: 18, fontWeight: '700' }}>
          ¿Qué hay cerca de ti?
        </Text>
        <Text style={{ marginTop: 8, opacity: 0.65 }}>
          Palta usa tu ubicación mientras estás usando esta pantalla. No la
          convierte automáticamente en tu casa o zona de vida.
        </Text>

        <Pressable
          disabled={locationBusy}
          onPress={() => void useMyLocation()}
          style={{ marginTop: 18, paddingVertical: 12 }}
        >
          <Text style={{ fontWeight: '700', opacity: locationBusy ? 0.5 : 1 }}>
            {locationBusy ? 'Buscando ubicación…' : 'Usar mi ubicación'}
          </Text>
        </Pressable>

        {mobileRuntime.status === 'ready' &&
        mobileRuntime.environment === 'development' ? (
          <Pressable
            onPress={() =>
              dispatch({
                type: 'set_effective_location',
                location: DEVELOPMENT_LOCATION,
              })
            }
            style={{ paddingVertical: 12 }}
          >
            <Text style={{ opacity: 0.6 }}>Usar ubicación de desarrollo</Text>
          </Pressable>
        ) : null}

        {locationError ? (
          <Text style={{ marginTop: 10, opacity: 0.65 }}>{locationError}</Text>
        ) : null}
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Tu barrio"
      subtitle="Ubicación activa · editable"
      scroll={false}
    >
      <View style={{ flex: 1 }}>
        <View style={{ minHeight: 250, flex: 1 }}>
          {mobileRuntime.status === 'ready' &&
          mobileRuntime.mapStyleUrl ? (
            <NeighborhoodMap
              mapStyle={mobileRuntime.mapStyleUrl}
              features={mapFeatures}
              initialCenter={neighborhood.effectiveLocation}
              onSelectEntity={(entityId) =>
                dispatch({ type: 'select_entity', entityId })
              }
              onViewportChanged={(center, zoom, userInteraction) =>
                dispatch({
                  type: 'set_viewport_center',
                  center,
                  zoom,
                  userInteraction,
                })
              }
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
              }}
            >
              <Text>Map Core preparado</Text>
              <Text style={{ marginTop: 6, opacity: 0.6 }}>
                Falta conectar EXPO_PUBLIC_MAP_STYLE_URL.
              </Text>
            </View>
          )}

          {neighborhood.mapMovedSinceSearch ? (
            <Pressable
              onPress={() =>
                dispatch({
                  type: 'search_current_viewport',
                  resultIds: visibleResults.map((item) => item.entity_id),
                })
              }
              style={{
                position: 'absolute',
                alignSelf: 'center',
                top: 14,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderWidth: 1,
                borderRadius: 999,
                backgroundColor: 'white',
              }}
            >
              <Text style={{ fontWeight: '700' }}>Buscar en esta zona</Text>
            </Pressable>
          ) : null}
        </View>

        <MapResultSheet
          snap={neighborhood.sheetSnap}
          onSnapChange={(snap) =>
            dispatch({ type: 'set_sheet_snap', snap })
          }
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingBottom: 10,
            }}
          >
            <FilterChip
              label="Abierto ahora"
              selected={neighborhood.activeFilters.includes('open_now')}
              onPress={() => {
                const next = neighborhood.activeFilters.includes('open_now')
                  ? neighborhood.activeFilters.filter(
                      (item) => item !== 'open_now',
                    )
                  : [...neighborhood.activeFilters, 'open_now'];
                dispatch({ type: 'set_filters', filters: next });
              }}
            />
            <FilterChip
              label="Verificado"
              selected={neighborhood.activeFilters.includes('verified')}
              onPress={() => {
                const next = neighborhood.activeFilters.includes('verified')
                  ? neighborhood.activeFilters.filter(
                      (item) => item !== 'verified',
                    )
                  : [...neighborhood.activeFilters, 'verified'];
                dispatch({ type: 'set_filters', filters: next });
              }}
            />
          </View>

          <Text style={{ fontSize: 13, fontWeight: '700', opacity: 0.6 }}>
            CERCA DE TI
          </Text>

          {state.status === 'loading' && !state.data ? (
            <LoadingState label="Buscando cerca…" />
          ) : null}

          {state.status === 'error' && !state.data ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}

          {state.status === 'empty' ? (
            <EmptyState
              title="No encontramos resultados aquí"
              body="Puedes mover el mapa o cambiar la búsqueda."
            />
          ) : null}

          {visibleResults.map((item) => (
            <LocalResultCard
              key={item.entity_id}
              name={item.name}
              meta={[
                item.category_key,
                item.verification_status === 'verified'
                  ? 'Verificado'
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
              distance={formatDistance(item.distance_m)}
              onPress={() => openEntity(item.entity_id, item.entity_type)}
            />
          ))}

          {state.status === 'error' && state.data ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}
        </MapResultSheet>
      </View>
    </ScreenFrame>
  );
}
