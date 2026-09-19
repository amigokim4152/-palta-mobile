import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FoodFulfillmentFilter } from '../../../../../src/business/foodFulfillmentDiscovery';
import {
  FOOD_VERTICAL_CATEGORIES,
  buildFoodVerticalQuery,
  type FoodVerticalCategoryId,
} from '../../../../../src/business/foodVertical';
import { localBusinessConsumerCategoryLabel } from '../../../../../src/business/localBusinessDiscoveryPreview';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { FilterChip } from '../../../components/common/FilterChip';
import { expoLocationAdapter } from '../../../adapters/expoLocationAdapter';
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
  type FoodDiscoveryItem,
} from './foodDiscoveryProjection';

const SANTIAGO_EXPLORATION_ORIGIN = {
  latitude: -33.4489,
  longitude: -70.6693,
} as const;

function formatDistance(distanceM?: number): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatFoodStatus(state?: string): string | undefined {
  if (state === 'open_now') return 'Abierto ahora';
  if (state === 'closed_now') return 'Cerrado ahora';
  if (state === 'closed_today') return 'Cerrado hoy';
  if (state === 'temporarily_closed') return 'Cerrado temporalmente';
  if (state === 'seasonal_closed') return 'Cerrado por temporada';
  if (state === 'unknown_or_stale') return 'Horario por confirmar';
  return undefined;
}

function FoodSearchBar({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: paltaTheme.spacing.xs,
        paddingLeft: paltaTheme.spacing.md,
        paddingRight: paltaTheme.spacing.xs,
        borderRadius: paltaTheme.radius.prominent,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      <Text style={{ fontSize: 18, color: paltaTheme.color.textMuted }}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="¿Qué quieres comer?"
        placeholderTextColor={paltaTheme.color.textMuted}
        returnKeyType="search"
        style={{
          flex: 1,
          minHeight: paltaTheme.touch.minimum,
          color: paltaTheme.color.textPrimary,
          fontSize: 16,
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        style={({ pressed }) => ({
          minHeight: 40,
          minWidth: 68,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: paltaTheme.spacing.sm,
          borderRadius: paltaTheme.radius.control,
          backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
        })}
      >
        <Text style={{ color: paltaTheme.color.surface, fontWeight: '800' }}>Buscar</Text>
      </Pressable>
    </View>
  );
}

function FoodResultCard({
  item,
  onPress,
}: {
  item: FoodDiscoveryItem;
  onPress: () => void;
}) {
  const categoryLabel = localBusinessConsumerCategoryLabel(item.category_key);
  const status = formatFoodStatus(item.operational_state);
  const distance = formatDistance(item.distance_m);
  const fulfillment = projectFoodItemFulfillment(item);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: paltaTheme.spacing.md,
        marginBottom: paltaTheme.spacing.sm,
        overflow: 'hidden',
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
      })}
    >
      {item.preview.photoUrl ? (
        <Image
          source={{ uri: item.preview.photoUrl }}
          resizeMode="cover"
          accessibilityLabel={`Foto de ${item.name}`}
          style={{ width: '100%', height: 168, backgroundColor: paltaTheme.color.surfaceMuted }}
        />
      ) : (
        <View
          style={{
            height: 126,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ fontSize: 38, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
            {item.name.trim().charAt(0).toUpperCase() || 'P'}
          </Text>
        </View>
      )}

      <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: paltaTheme.spacing.sm }}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontSize: 19,
              lineHeight: 24,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          >
            {item.name}
          </Text>
          {item.verification_status === 'verified' ? (
            <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              ✓ Verificado
            </Text>
          ) : null}
        </View>

        <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>
          {[status, categoryLabel, distance].filter(Boolean).join(' · ') || 'Comida cerca de ti'}
        </Text>

        {fulfillment.labels.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {fulfillment.labels.map((label) => (
              <View
                key={label}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  borderRadius: paltaTheme.radius.pill,
                  backgroundColor: paltaTheme.color.brandSoft,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.preview.serviceLabels.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {item.preview.serviceLabels.slice(0, 3).map((label) => (
              <View
                key={label}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                  borderRadius: paltaTheme.radius.pill,
                  backgroundColor: paltaTheme.color.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.textSecondary }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.preview.highlight ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>
            {item.preview.highlight.label}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: paltaTheme.spacing.xxs,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: paltaTheme.radius.control,
            backgroundColor: paltaTheme.color.brandPrimary,
          }}
        >
          <Text style={{ color: paltaTheme.color.surface, fontSize: 14, fontWeight: '800' }}>
            Ver opciones para pedir
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function FoodLocationStart({
  locationBusy,
  locationError,
  onUseMyLocation,
  onExploreSantiago,
}: {
  locationBusy: boolean;
  locationError: string | null;
  onUseMyLocation: () => void;
  onExploreSantiago: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: paltaTheme.spacing.lg,
          gap: paltaTheme.spacing.md,
        }}
      >
        <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Comida cerca de ti
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 21, color: paltaTheme.color.textSecondary }}>
          Usa tu zona para encontrar restaurantes y opciones de pedido cercanas.
        </Text>
        <Pressable
          disabled={locationBusy}
          onPress={onUseMyLocation}
          style={({ pressed }) => ({
            minHeight: 56,
            justifyContent: 'center',
            paddingHorizontal: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
            opacity: locationBusy ? 0.6 : 1,
          })}
        >
          <Text style={{ color: paltaTheme.color.surface, fontWeight: '800', fontSize: 16 }}>
            {locationBusy ? 'Buscando…' : 'Buscar cerca de mí'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onExploreSantiago}
          style={({ pressed }) => ({
            minHeight: 56,
            justifyContent: 'center',
            paddingHorizontal: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
          })}
        >
          <Text style={{ color: paltaTheme.color.textPrimary, fontWeight: '800', fontSize: 16 }}>
            Explorar Santiago
          </Text>
        </Pressable>
        {locationError ? (
          <Text style={{ color: paltaTheme.color.textSecondary }}>{locationError}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export function FoodDiscoveryExperience() {
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const [categoryId, setCategoryId] = useState<FoodVerticalCategoryId>('all');
  const [draftQuery, setDraftQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FoodFulfillmentFilter>('any');
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const searchPoint = neighborhood.searchOrigin ?? neighborhood.effectiveLocation;
  const searchQuery = useMemo(
    () => buildFoodVerticalQuery({ categoryId, freeText: submittedQuery }),
    [categoryId, submittedQuery],
  );

  const cacheKey = useMemo(
    () =>
      searchPoint
        ? localBusinessDiscoveryCacheKey({
            latitude: searchPoint.latitude,
            longitude: searchPoint.longitude,
            query: searchQuery,
          })
        : null,
    [searchPoint?.latitude, searchPoint?.longitude, searchQuery],
  );

  const cachedResults = useMemo(
    () => (cacheKey ? readLocalBusinessDiscoveryCache(cacheKey) : undefined),
    [cacheKey],
  );

  const loadResults = useCallback(async () => {
    if (!searchPoint) return [];
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const items = await mobileRuntime.client.searchLocal({
      latitude: searchPoint.latitude,
      longitude: searchPoint.longitude,
      query: searchQuery,
    });
    if (cacheKey) writeLocalBusinessDiscoveryCache(cacheKey, items);
    return items;
  }, [searchPoint?.latitude, searchPoint?.longitude, searchQuery, cacheKey]);

  const { state, refresh } = useAsyncResource(loadResults, {
    enabled: searchPoint !== null,
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

  async function useMyLocation() {
    setLocationBusy(true);
    setLocationError(null);
    try {
      let permission = await expoLocationAdapter.getPermission();
      if (permission !== 'granted_foreground') {
        permission = await expoLocationAdapter.requestForegroundPermission();
      }
      if (permission !== 'granted_foreground') {
        setLocationError('Puedes explorar sin compartir tu ubicación exacta.');
        return;
      }
      const point = await expoLocationAdapter.getCurrentPosition();
      dispatch({ type: 'set_effective_location', location: point });
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'No pudimos obtener tu ubicación.');
    } finally {
      setLocationBusy(false);
    }
  }

  function exploreSantiago() {
    setLocationError(null);
    dispatch({ type: 'set_effective_location', location: SANTIAGO_EXPLORATION_ORIGIN });
  }

  function toggleFulfillmentFilter(next: Exclude<FoodFulfillmentFilter, 'any'>) {
    setFulfillmentFilter((current) => (current === next ? 'any' : next));
  }

  function openMap() {
    router.push({
      pathname: '/local-businesses/food/map',
      params: {
        categoryId,
        q: submittedQuery,
        fulfillment: fulfillmentFilter,
        open: openNowOnly ? '1' : '0',
      },
    });
  }

  if (!neighborhood.effectiveLocation) {
    return (
      <FoodLocationStart
        locationBusy={locationBusy}
        locationError={locationError}
        onUseMyLocation={() => void useMyLocation()}
        onExploreSantiago={exploreSantiago}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: paltaTheme.spacing.xl }}
        stickyHeaderIndices={[0]}
      >
        <View
          style={{
            backgroundColor: paltaTheme.color.canvas,
            paddingTop: paltaTheme.spacing.xs,
            paddingBottom: paltaTheme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: paltaTheme.color.divider,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: paltaTheme.spacing.sm,
              paddingHorizontal: paltaTheme.spacing.md,
              paddingBottom: paltaTheme.spacing.sm,
            }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
              })}
            >
              <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Comida
              </Text>
              <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
                Elige qué quieres comer y después el local.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openMap}
              style={({ pressed }) => ({
                minHeight: 42,
                justifyContent: 'center',
                paddingHorizontal: paltaTheme.spacing.sm,
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: pressed ? paltaTheme.color.brandSoft : paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              })}
            >
              <Text style={{ fontWeight: '800', color: paltaTheme.color.brandPrimary }}>Mapa</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
            <FoodSearchBar
              value={draftQuery}
              onChangeText={setDraftQuery}
              onSubmit={() => setSubmittedQuery(draftQuery.trim())}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: paltaTheme.spacing.xs,
              paddingHorizontal: paltaTheme.spacing.md,
              paddingTop: paltaTheme.spacing.sm,
            }}
          >
            {FOOD_VERTICAL_CATEGORIES.map((category) => (
              <FilterChip
                key={category.id}
                label={category.label}
                selected={category.id === categoryId}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: paltaTheme.spacing.xs,
              paddingHorizontal: paltaTheme.spacing.md,
              paddingTop: paltaTheme.spacing.xs,
              alignItems: 'center',
            }}
          >
            <FilterChip
              label="Abiertos ahora"
              selected={openNowOnly}
              onPress={() => setOpenNowOnly((current) => !current)}
            />
            <FilterChip
              label="Delivery"
              selected={fulfillmentFilter === 'delivery'}
              onPress={() => toggleFulfillmentFilter('delivery')}
            />
            <FilterChip
              label="Retiro"
              selected={fulfillmentFilter === 'pickup'}
              onPress={() => toggleFulfillmentFilter('pickup')}
            />
          </ScrollView>

          <View style={{ paddingHorizontal: paltaTheme.spacing.md, paddingTop: paltaTheme.spacing.xs }}>
            <Text style={{ fontSize: 12, textAlign: 'right', color: paltaTheme.color.textMuted }}>
              {businesses.length} {businesses.length === 1 ? 'opción' : 'opciones'}
            </Text>
          </View>
        </View>

        <View style={{ paddingTop: paltaTheme.spacing.md }}>
          {state.status === 'loading' && !state.data ? (
            <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
              <LoadingState label="Buscando comida cerca de ti…" />
            </View>
          ) : null}

          {state.status === 'error' && !state.data ? (
            <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
              <ErrorState message={state.message} onRetry={() => void refresh()} />
            </View>
          ) : null}

          {businesses.length === 0 && state.status !== 'loading' ? (
            <View
              style={{
                marginHorizontal: paltaTheme.spacing.md,
                padding: paltaTheme.spacing.lg,
                gap: paltaTheme.spacing.xs,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                No encontramos opciones aquí
              </Text>
              <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                Prueba otro tipo de comida o quita algún filtro. Delivery y retiro solo muestran opciones confirmadas.
              </Text>
            </View>
          ) : null}

          {businesses.map((item) => (
            <FoodResultCard
              key={item.entity_id}
              item={item}
              onPress={() =>
                router.push(`/local-businesses/food/${encodeURIComponent(item.entity_id)}`)
              }
            />
          ))}

          {state.status === 'error' && state.data ? (
            <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
              <ErrorState message={state.message} onRetry={() => void refresh()} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
