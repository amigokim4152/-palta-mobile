import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import type { MapFeature } from '../../../../../src/adapters/mapCore';
import type { FoodFulfillmentFilter } from '../../../../../src/business/foodFulfillmentDiscovery';
import {
  FOOD_VERTICAL_CATEGORIES,
  buildFoodVerticalQuery,
  type FoodVerticalCategoryId,
} from '../../../../../src/business/foodVertical';
import { localBusinessConsumerCategoryLabel } from '../../../../../src/business/localBusinessDiscoveryPreview';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { LocalResultCard } from '../../../components/LocalResultCard';
import { FilterChip } from '../../../components/common/FilterChip';
import { NeighborhoodMap } from '../../../components/map/NeighborhoodMap';
import { MapResultSheet } from '../../../components/neighborhood/MapResultSheet';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';
import { useNeighborhoodState } from '../../../state/NeighborhoodStateProvider';
import {
  localBusinessDiscoveryCacheKey,
  readLocalBusinessDiscoveryCache,
  writeLocalBusinessDiscoveryCache,
} from '../localBusinessDiscoveryCache';
import { paltaTheme } from '../../../theme/paltaTheme';
import {
  projectFoodItemFulfillment,
  projectFoodSearchResults,
} from './foodDiscoveryProjection';

const SANTIAGO_EXPLORATION_ORIGIN = {
  latitude: -33.4489,
  longitude: -70.6693,
} as const;

function parseCategory(value: string | undefined): FoodVerticalCategoryId {
  return FOOD_VERTICAL_CATEGORIES.some((category) => category.id === value)
    ? (value as FoodVerticalCategoryId)
    : 'all';
}

function parseFulfillment(value: string | undefined): FoodFulfillmentFilter {
  if (value === 'delivery' || value === 'pickup') return value;
  return 'any';
}

function formatDistance(distanceM?: number): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

export function FoodMapExperience() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    q?: string;
    fulfillment?: string;
    open?: string;
  }>();
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const categoryId = parseCategory(params.categoryId);
  const freeText = params.q?.trim() ?? '';
  const [openNowOnly, setOpenNowOnly] = useState(params.open === '1');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FoodFulfillmentFilter>(
    parseFulfillment(params.fulfillment),
  );

  const searchPoint =
    neighborhood.searchOrigin ??
    neighborhood.effectiveLocation ??
    SANTIAGO_EXPLORATION_ORIGIN;
  const searchQuery = useMemo(
    () => buildFoodVerticalQuery({ categoryId, freeText }),
    [categoryId, freeText],
  );
  const cacheKey = useMemo(
    () =>
      localBusinessDiscoveryCacheKey({
        latitude: searchPoint.latitude,
        longitude: searchPoint.longitude,
        query: searchQuery,
      }),
    [searchPoint.latitude, searchPoint.longitude, searchQuery],
  );
  const cachedResults = useMemo(
    () => readLocalBusinessDiscoveryCache(cacheKey),
    [cacheKey],
  );

  const loadResults = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const items = await mobileRuntime.client.searchLocal({
      latitude: searchPoint.latitude,
      longitude: searchPoint.longitude,
      query: searchQuery,
    });
    writeLocalBusinessDiscoveryCache(cacheKey, items);
    return items;
  }, [searchPoint.latitude, searchPoint.longitude, searchQuery, cacheKey]);

  const { state, refresh } = useAsyncResource(loadResults, {
    enabled: true,
    isEmpty: (items) => items.length === 0,
    ...(cachedResults ? { initialData: cachedResults } : {}),
  });

  const businesses = useMemo(
    () =>
      projectFoodSearchResults(state.data ?? [], {
        openNowOnly,
        fulfillmentFilter,
      }),
    [state.data, openNowOnly, fulfillmentFilter],
  );

  const selectedBusiness = useMemo(
    () => businesses.find((item) => item.entity_id === neighborhood.selectedEntityId),
    [businesses, neighborhood.selectedEntityId],
  );

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      businesses
        .filter((item) => item.location !== undefined)
        .map((item) => ({
          id: item.entity_id,
          entityType: 'business',
          coordinate: {
            latitude: item.location!.lat,
            longitude: item.location!.lng,
          },
          title: item.name,
          ...(item.category_key ? { categoryKey: item.category_key } : {}),
          selected: item.entity_id === neighborhood.selectedEntityId,
        })),
    [businesses, neighborhood.selectedEntityId],
  );

  function toggleFulfillment(next: Exclude<FoodFulfillmentFilter, 'any'>) {
    setFulfillmentFilter((current) => (current === next ? 'any' : next));
  }

  function selectBusiness(entityId: string) {
    dispatch({ type: 'select_entity', entityId });
    dispatch({ type: 'set_sheet_snap', snap: 'half' });
  }

  function openBusiness(entityId: string) {
    dispatch({ type: 'select_entity', entityId });
    router.push(`/local-businesses/food/${encodeURIComponent(entityId)}`);
  }

  function renderBusinessCard(item: (typeof businesses)[number], selected = false) {
    const categoryLabel = localBusinessConsumerCategoryLabel(item.category_key);
    const fulfillment = projectFoodItemFulfillment(item);
    const serviceLabels = [
      ...fulfillment.labels,
      ...item.preview.serviceLabels,
    ].filter((label, index, list) => list.indexOf(label) === index).slice(0, 4);

    return (
      <LocalResultCard
        key={item.entity_id}
        selected={selected}
        name={item.name}
        meta={[
          categoryLabel,
          item.verification_status === 'verified' ? 'Verificado' : undefined,
        ].filter(Boolean).join(' · ')}
        distance={item.location ? formatDistance(item.distance_m) : 'Zona de atención'}
        imageUrl={item.preview.photoUrl}
        serviceLabels={serviceLabels}
        highlight={item.preview.highlight?.label}
        onPress={() => openBusiness(item.entity_id)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.surfaceMuted }}>
      <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          {mobileRuntime.status === 'ready' && mobileRuntime.mapStyleUrl ? (
            <NeighborhoodMap
              mapStyle={mobileRuntime.mapStyleUrl}
              features={mapFeatures}
              initialCenter={
                neighborhood.camera?.center ??
                neighborhood.effectiveLocation ??
                SANTIAGO_EXPLORATION_ORIGIN
              }
              initialZoom={neighborhood.camera?.zoom ?? 14}
              onSelectEntity={selectBusiness}
              onViewportChanged={(center, zoom, userInteraction) =>
                dispatch({ type: 'set_viewport_center', center, zoom, userInteraction })
              }
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: paltaTheme.spacing.xl,
                backgroundColor: paltaTheme.color.surfaceMuted,
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                El mapa no está disponible en este momento
              </Text>
            </View>
          )}
        </View>

        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: paltaTheme.spacing.xs }}
        >
          <View
            style={{
              marginHorizontal: paltaTheme.spacing.sm,
              padding: paltaTheme.spacing.xs,
              gap: paltaTheme.spacing.xs,
              borderRadius: paltaTheme.radius.prominent,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  minWidth: 42,
                  minHeight: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: paltaTheme.radius.pill,
                  backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
                })}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>‹</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  Comida en el mapa
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                  {FOOD_VERTICAL_CATEGORIES.find((item) => item.id === categoryId)?.label ?? 'Todo'}
                  {freeText ? ` · ${freeText}` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                {businesses.length}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
              <FilterChip
                label="Abiertos ahora"
                selected={openNowOnly}
                onPress={() => setOpenNowOnly((current) => !current)}
              />
              <FilterChip
                label="Delivery"
                selected={fulfillmentFilter === 'delivery'}
                onPress={() => toggleFulfillment('delivery')}
              />
              <FilterChip
                label="Retiro"
                selected={fulfillmentFilter === 'pickup'}
                onPress={() => toggleFulfillment('pickup')}
              />
            </View>
          </View>
        </View>

        {neighborhood.mapMovedSinceSearch ? (
          <Pressable
            onPress={() =>
              dispatch({
                type: 'search_current_viewport',
                resultIds: businesses.map((item) => item.entity_id),
              })
            }
            style={({ pressed }) => ({
              position: 'absolute',
              alignSelf: 'center',
              top: 126,
              minHeight: paltaTheme.touch.minimum,
              justifyContent: 'center',
              paddingHorizontal: paltaTheme.spacing.md,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
            })}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
              Buscar en esta zona
            </Text>
          </Pressable>
        ) : null}

        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%' }}>
          <MapResultSheet
            snap={neighborhood.sheetSnap}
            onSnapChange={(snap) => dispatch({ type: 'set_sheet_snap', snap })}
          >
            <View style={{ width: '100%', paddingTop: paltaTheme.spacing.xs }}>
              {state.status === 'loading' && !state.data ? (
                <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
                  <LoadingState label="Buscando comida…" />
                </View>
              ) : null}
              {state.status === 'error' && !state.data ? (
                <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
                  <ErrorState message={state.message} onRetry={() => void refresh()} />
                </View>
              ) : null}
              {selectedBusiness ? renderBusinessCard(selectedBusiness, true) : null}
              {businesses
                .filter((item) => item.entity_id !== selectedBusiness?.entity_id)
                .map((item) => renderBusinessCard(item))}
              {businesses.length === 0 && state.status !== 'loading' ? (
                <View style={{ padding: paltaTheme.spacing.lg, gap: paltaTheme.spacing.xs }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                    No hay opciones confirmadas aquí
                  </Text>
                  <Text style={{ color: paltaTheme.color.textSecondary }}>
                    Mueve el mapa o quita Delivery/Retiro para ampliar la búsqueda.
                  </Text>
                </View>
              ) : null}
            </View>
          </MapResultSheet>
        </View>
      </View>
    </SafeAreaView>
  );
}
