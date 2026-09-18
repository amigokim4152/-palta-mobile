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
import { useLocalization } from '../../providers/LocalizationProvider';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';

const DEVELOPMENT_LOCATION = {
  latitude: -33.3908,
  longitude: -70.5707,
};

function formatDistance(
  distanceM: number | undefined,
  locale: string,
): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(distanceM / 1000)} km`;
}

export function NeighborhoodScreen() {
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const { locale, t } = useLocalization();
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
            ? t('neighborhood.locationRestricted')
            : t('neighborhood.locationDenied'),
        );
        return;
      }

      const point = await expoLocationAdapter.getCurrentPosition();
      dispatch({ type: 'set_effective_location', location: point });
    } catch {
      setLocationError(t('neighborhood.locationUnavailable'));
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
        title={t('neighborhood.title')}
        subtitle={t('neighborhood.permissionSubtitle')}
      >
        <Text style={{ fontSize: 18, fontWeight: '700' }}>
          {t('neighborhood.nearbyPrompt')}
        </Text>
        <Text style={{ marginTop: 8, opacity: 0.65 }}>
          {t('neighborhood.locationUseExplanation')}
        </Text>

        <Pressable
          disabled={locationBusy}
          onPress={() => void useMyLocation()}
          style={{ marginTop: 18, paddingVertical: 12 }}
        >
          <Text style={{ fontWeight: '700', opacity: locationBusy ? 0.5 : 1 }}>
            {locationBusy
              ? t('neighborhood.locating')
              : t('neighborhood.useLocation')}
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
            <Text style={{ opacity: 0.6 }}>
              {t('neighborhood.useDevelopmentLocation')}
            </Text>
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
      title={t('neighborhood.title')}
      subtitle={t('neighborhood.activeSubtitle')}
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
              <Text>{t('neighborhood.mapPrepared')}</Text>
              <Text style={{ marginTop: 6, opacity: 0.6 }}>
                {t('neighborhood.mapStyleMissing')}
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
              <Text style={{ fontWeight: '700' }}>
                {t('neighborhood.searchArea')}
              </Text>
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
              label={t('neighborhood.openNow')}
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
              label={t('common.verified')}
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
            {t('neighborhood.nearYou')}
          </Text>

          {state.status === 'loading' && !state.data ? (
            <LoadingState label={t('neighborhood.loading')} />
          ) : null}

          {state.status === 'error' && !state.data ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}

          {state.status === 'empty' ? (
            <EmptyState
              title={t('neighborhood.emptyTitle')}
              body={t('neighborhood.emptyBody')}
            />
          ) : null}

          {visibleResults.map((item) => (
            <LocalResultCard
              key={item.entity_id}
              name={item.name}
              meta={[
                item.category_key,
                item.verification_status === 'verified'
                  ? t('common.verified')
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
              distance={formatDistance(item.distance_m, locale)}
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
