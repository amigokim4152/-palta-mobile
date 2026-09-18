import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import {
  LOCAL_BUSINESS_SHORTCUTS,
  projectLocalBusinesses,
} from '../../../../src/business/localBusinessDiscovery';
import type { BusinessOperationalState } from '../../../../src/business/businessOperationalState';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { LocalResultCard } from '../../components/LocalResultCard';
import { FilterChip } from '../../components/common/FilterChip';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { MapResultSheet } from '../../components/neighborhood/MapResultSheet';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';
import {
  localBusinessDiscoveryCacheKey,
  readLocalBusinessDiscoveryCache,
  writeLocalBusinessDiscoveryCache,
} from './localBusinessDiscoveryCache';
import { BusinessVerticalHandoffBar } from './BusinessVerticalHandoffBar';
import { paltaTheme } from '../../theme/paltaTheme';

const SANTIAGO_EXPLORATION_ORIGIN = {
  latitude: -33.4489,
  longitude: -70.6693,
} as const;

const FILTER_OPEN_NOW = 'local_business:open_now';
const FILTER_VERIFIED = 'local_business:verified';

const CATEGORY_SERVICE_LABELS: Record<string, readonly string[]> = {
  auto_repair: ['Taller mecánico'],
  pharmacy: ['Farmacia'],
  restaurant: ['Restaurante'],
  cafe: ['Café'],
  bakery: ['Panadería'],
  beauty: ['Belleza'],
  home_repair: ['Hogar y reparación'],
  pet: ['Mascotas'],
  education: ['Clases y educación'],
  professional_service: ['Servicios profesionales'],
};

type DiscoveryVisual = {
  imageUrl?: string;
  serviceLabels: string[];
  highlight?: string;
};

function discoveryVisual(value: unknown): DiscoveryVisual {
  if (!value || typeof value !== 'object') return { serviceLabels: [] };
  const row = value as Record<string, unknown>;
  const imageUrl = typeof row.image_url === 'string' ? row.image_url : undefined;
  const explicitServices = Array.isArray(row.service_labels)
    ? row.service_labels.filter((item): item is string => typeof item === 'string').slice(0, 2)
    : [];
  const categoryKey = typeof row.category_key === 'string' ? row.category_key : undefined;
  const serviceLabels = explicitServices.length
    ? explicitServices
    : categoryKey
      ? [...(CATEGORY_SERVICE_LABELS[categoryKey] ?? [])]
      : [];
  const explicitHighlight = typeof row.highlight === 'string' ? row.highlight.trim() : '';
  const highlight = explicitHighlight
    ? explicitHighlight
    : row.verification_status === 'verified'
      ? 'Negocio verificado'
      : undefined;

  return {
    ...(imageUrl ? { imageUrl } : {}),
    serviceLabels,
    ...(highlight ? { highlight } : {}),
  };
}

function isEmptyResults(items: readonly unknown[]) {
  return items.length === 0;
}

function formatDistance(distanceM?: number): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatOperationalState(
  state?: BusinessOperationalState,
  nextOpenAt?: string,
): string | undefined {
  switch (state) {
    case 'open_now':
      return 'Abierto ahora';
    case 'closed_now':
      return nextOpenAt
        ? `Cerrado · abre ${new Date(nextOpenAt).toLocaleString('es-CL', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : 'Cerrado ahora';
    case 'closed_today':
      return 'Cerrado hoy';
    case 'temporarily_closed':
      return 'Cerrado temporalmente';
    case 'seasonal_closed':
      return 'Cerrado por temporada';
    case 'paused':
      return 'Atención pausada';
    case 'permanently_closed':
      return 'Cerrado';
    case 'unknown_or_stale':
      return 'Horario por confirmar';
    default:
      return undefined;
  }
}

function SearchBar({
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: paltaTheme.spacing.xs,
        minHeight: 52,
        paddingLeft: paltaTheme.spacing.md,
        paddingRight: paltaTheme.spacing.xs,
        borderRadius: paltaTheme.radius.prominent,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
      }}
    >
      <Text accessibilityElementsHidden style={{ fontSize: 19, color: paltaTheme.color.textMuted }}>
        ⌕
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="¿Qué necesitas?"
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
          justifyContent: 'center',
          alignItems: 'center',
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

function OverlayAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 34,
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.pill,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyLocationStart({
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
        <Text
          style={{
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '800',
            letterSpacing: -0.6,
            color: paltaTheme.color.textPrimary,
          }}
        >
          Encuentra negocios y servicios cerca de ti.
        </Text>
        <Pressable
          disabled={locationBusy}
          onPress={onUseMyLocation}
          style={({ pressed }) => ({
            minHeight: 58,
            justifyContent: 'center',
            paddingHorizontal: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
            opacity: locationBusy ? 0.6 : 1,
          })}
        >
          <Text style={{ color: paltaTheme.color.surface, fontSize: 16, fontWeight: '800' }}>
            {locationBusy ? 'Buscando…' : 'Buscar cerca de mí'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onExploreSantiago}
          style={({ pressed }) => ({
            minHeight: 58,
            justifyContent: 'center',
            paddingHorizontal: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
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

export function BusinessDiscoveryExperience() {
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const [draftQuery, setDraftQuery] = useState(neighborhood.query);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const verifiedOnly = neighborhood.activeFilters.includes(FILTER_VERIFIED);
  const openNowOnly = neighborhood.activeFilters.includes(FILTER_OPEN_NOW);
  const searchPoint = neighborhood.searchOrigin ?? neighborhood.effectiveLocation;

  const discoveryCacheKey = useMemo(
    () =>
      searchPoint
        ? localBusinessDiscoveryCacheKey({
            latitude: searchPoint.latitude,
            longitude: searchPoint.longitude,
            ...(neighborhood.query ? { query: neighborhood.query } : {}),
          })
        : null,
    [searchPoint?.latitude, searchPoint?.longitude, neighborhood.query],
  );

  const cachedResults = useMemo(
    () => (discoveryCacheKey ? readLocalBusinessDiscoveryCache(discoveryCacheKey) : undefined),
    [discoveryCacheKey],
  );

  const loadResults = useCallback(async () => {
    if (!searchPoint) return [];
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const items = await mobileRuntime.client.searchLocal({
      latitude: searchPoint.latitude,
      longitude: searchPoint.longitude,
      ...(neighborhood.query ? { query: neighborhood.query } : {}),
    });
    if (discoveryCacheKey) writeLocalBusinessDiscoveryCache(discoveryCacheKey, items);
    return items;
  }, [searchPoint?.latitude, searchPoint?.longitude, neighborhood.query, discoveryCacheKey]);

  const { state, refresh } = useAsyncResource(loadResults, {
    enabled: searchPoint !== null,
    isEmpty: isEmptyResults,
    ...(cachedResults ? { initialData: cachedResults } : {}),
  });

  const businesses = useMemo(() => {
    const projected = projectLocalBusinesses(
      (state.data ?? []).map((item) => ({
        entityId: item.entity_id,
        entityType: item.entity_type,
        name: item.name,
        ...(item.category_key ? { categoryKey: item.category_key } : {}),
        ...(item.distance_m !== undefined ? { distanceM: item.distance_m } : {}),
        ...(item.verification_status ? { verificationStatus: item.verification_status } : {}),
        ...(item.operational_state ? { operationalState: item.operational_state } : {}),
        ...(item.operational_confirmed_at
          ? { operationalConfirmedAt: item.operational_confirmed_at }
          : {}),
        ...(item.location ? { location: item.location } : {}),
        source: item,
      })),
      { verifiedOnly, openNowOnly },
    );
    return projected.map((item) => item.source);
  }, [state.data, verifiedOnly, openNowOnly]);

  const selectedBusiness = useMemo(
    () => businesses.find((item) => item.entity_id === neighborhood.selectedEntityId),
    [businesses, neighborhood.selectedEntityId],
  );
  const selectedVisual = useMemo(() => discoveryVisual(selectedBusiness), [selectedBusiness]);

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

  function setFilter(filter: string, enabled: boolean) {
    const next = new Set(neighborhood.activeFilters);
    if (enabled) next.add(filter);
    else next.delete(filter);
    dispatch({ type: 'set_filters', filters: [...next] });
  }

  function submitSearch(query = draftQuery) {
    const next = query.trim();
    setDraftQuery(next);
    dispatch({ type: 'set_query', query: next });
  }

  function selectBusinessFromMap(entityId: string) {
    dispatch({ type: 'select_entity', entityId });
    dispatch({ type: 'set_sheet_snap', snap: 'half' });
  }

  function openBusiness(entityId: string) {
    dispatch({ type: 'select_entity', entityId });
    router.push(`/business/${encodeURIComponent(entityId)}`);
  }

  async function useMyLocation() {
    setLocationBusy(true);
    setLocationError(null);
    try {
      let permission = await expoLocationAdapter.getPermission();
      if (permission !== 'granted_foreground') {
        permission = await expoLocationAdapter.requestForegroundPermission();
      }
      if (permission !== 'granted_foreground') {
        setLocationError('Puedes seguir explorando sin compartir tu ubicación exacta.');
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

  function renderBusinessCard(item: (typeof businesses)[number], selected = false) {
    const visual = discoveryVisual(item);
    return (
      <LocalResultCard
        key={item.entity_id}
        selected={selected}
        name={item.name}
        meta={[
          formatOperationalState(item.operational_state, item.next_open_at),
          item.category_key,
          item.verification_status === 'verified' ? 'Verificado' : undefined,
        ].filter(Boolean).join(' · ')}
        distance={item.location ? formatDistance(item.distance_m) : 'Zona de atención'}
        imageUrl={visual.imageUrl}
        serviceLabels={visual.serviceLabels}
        highlight={visual.highlight}
        onPress={() => openBusiness(item.entity_id)}
      />
    );
  }

  if (!neighborhood.effectiveLocation) {
    return (
      <EmptyLocationStart
        locationBusy={locationBusy}
        locationError={locationError}
        onUseMyLocation={() => void useMyLocation()}
        onExploreSantiago={exploreSantiago}
      />
    );
  }

  const resultHeader = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: paltaTheme.spacing.sm,
        paddingHorizontal: paltaTheme.spacing.md,
        paddingTop: paltaTheme.spacing.xxs,
        paddingBottom: paltaTheme.spacing.sm,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
        {neighborhood.query ? 'Resultados' : 'Cerca de aquí'}
      </Text>
      <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
        {businesses.length} {businesses.length === 1 ? 'negocio' : 'negocios'}
      </Text>
    </View>
  );

  const resultsContent = (
    <View style={{ width: '100%' }}>
      {selectedBusiness ? (
        <>
          <View
            style={{
              paddingHorizontal: paltaTheme.spacing.md,
              paddingBottom: paltaTheme.spacing.xxs,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
              Seleccionado
            </Text>
          </View>
          <LocalResultCard
            selected
            name={selectedBusiness.name}
            meta={[
              formatOperationalState(selectedBusiness.operational_state, selectedBusiness.next_open_at),
              selectedBusiness.category_key,
              selectedBusiness.verification_status === 'verified' ? 'Verificado' : undefined,
            ].filter(Boolean).join(' · ')}
            distance={selectedBusiness.location ? formatDistance(selectedBusiness.distance_m) : 'Zona de atención'}
            imageUrl={selectedVisual.imageUrl}
            serviceLabels={selectedVisual.serviceLabels}
            highlight={selectedVisual.highlight}
            onPress={() => openBusiness(selectedBusiness.entity_id)}
          />
        </>
      ) : null}

      <BusinessVerticalHandoffBar />

      {resultHeader}

      {state.status === 'loading' && !state.data ? (
        <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
          <LoadingState label="Buscando negocios…" />
        </View>
      ) : null}
      {state.status === 'error' && !state.data ? (
        <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        </View>
      ) : null}
      {businesses.length === 0 && state.status !== 'loading' ? (
        <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
          <EmptyState
            title="No encontramos opciones aquí"
            body={openNowOnly
              ? 'Quita “Abiertos ahora” o mueve el mapa para ver más opciones.'
              : 'Prueba otra búsqueda o mueve el mapa a otra zona.'}
          />
        </View>
      ) : null}

      {businesses
        .filter((item) => item.entity_id !== selectedBusiness?.entity_id)
        .map((item) => renderBusinessCard(item))}

      {state.status === 'error' && state.data ? (
        <View style={{ paddingHorizontal: paltaTheme.spacing.md }}>
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.surfaceMuted }}>
      <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          {mobileRuntime.status === 'ready' && mobileRuntime.mapStyleUrl ? (
            <NeighborhoodMap
              mapStyle={mobileRuntime.mapStyleUrl}
              features={mapFeatures}
              initialCenter={neighborhood.camera?.center ?? neighborhood.effectiveLocation}
              initialZoom={neighborhood.camera?.zoom ?? 14}
              onSelectEntity={selectBusinessFromMap}
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
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 17,
                  fontWeight: '800',
                  color: paltaTheme.color.textPrimary,
                }}
              >
                El mapa no está disponible en este momento
              </Text>
            </View>
          )}
        </View>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: paltaTheme.spacing.xs,
          }}
        >
          <View style={{ paddingHorizontal: paltaTheme.spacing.sm }}>
            <SearchBar value={draftQuery} onChangeText={setDraftQuery} onSubmit={() => submitSearch()} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: paltaTheme.spacing.xs,
              paddingHorizontal: paltaTheme.spacing.sm,
              paddingVertical: paltaTheme.spacing.xs,
            }}
          >
            {LOCAL_BUSINESS_SHORTCUTS.map((shortcut) => (
              <FilterChip
                key={shortcut.id}
                label={shortcut.label}
                selected={neighborhood.query === shortcut.query}
                onPress={() => submitSearch(shortcut.query)}
              />
            ))}
            <FilterChip
              label="Abiertos ahora"
              selected={openNowOnly}
              onPress={() => setFilter(FILTER_OPEN_NOW, !openNowOnly)}
            />
            <FilterChip
              label="Verificados"
              selected={verifiedOnly}
              onPress={() => setFilter(FILTER_VERIFIED, !verifiedOnly)}
            />
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: paltaTheme.spacing.xs,
              paddingHorizontal: paltaTheme.spacing.sm,
            }}
          >
            <OverlayAction label="Siguiendo" onPress={() => router.push('/local-businesses/following')} />
            <OverlayAction label="Mi negocio" onPress={() => router.push('/business/register')} />
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
              top: 152,
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
            {resultsContent}
          </MapResultSheet>
        </View>
      </View>
    </SafeAreaView>
  );
}
