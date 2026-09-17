import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
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
import { ScreenFrame } from '../../components/ScreenFrame';
import { expoLocationAdapter } from '../../adapters/expoLocationAdapter';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';
import { useNeighborhoodState } from '../../state/NeighborhoodStateProvider';
import {
  localBusinessDiscoveryCacheKey,
  readLocalBusinessDiscoveryCache,
  writeLocalBusinessDiscoveryCache,
} from './localBusinessDiscoveryCache';
import { paltaTheme } from '../../theme/paltaTheme';

const SANTIAGO_EXPLORATION_ORIGIN = {
  latitude: -33.4489,
  longitude: -70.6693,
} as const;

const FILTER_OPEN_NOW = 'local_business:open_now';
const FILTER_VERIFIED = 'local_business:verified';

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

export function LocalBusinessDiscoveryScreen() {
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
    () =>
      discoveryCacheKey
        ? readLocalBusinessDiscoveryCache(discoveryCacheKey)
        : undefined,
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
    if (discoveryCacheKey) {
      writeLocalBusinessDiscoveryCache(discoveryCacheKey, items);
    }
    return items;
  }, [
    searchPoint?.latitude,
    searchPoint?.longitude,
    neighborhood.query,
    discoveryCacheKey,
  ]);

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
        ...(item.verification_status
          ? { verificationStatus: item.verification_status }
          : {}),
        ...(item.operational_state
          ? { operationalState: item.operational_state }
          : {}),
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

  function selectBusinessFromMap(entityId: string) {
    dispatch({ type: 'select_entity', entityId });
    dispatch({ type: 'set_sheet_snap', snap: 'peek' });
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
        setLocationError('No necesitas compartir tu ubicación para explorar negocios.');
        return;
      }
      const point = await expoLocationAdapter.getCurrentPosition();
      dispatch({ type: 'set_effective_location', location: point });
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'No pudimos obtener tu ubicación.',
      );
    } finally {
      setLocationBusy(false);
    }
  }

  function exploreSantiago() {
    setLocationError(null);
    dispatch({
      type: 'set_effective_location',
      location: SANTIAGO_EXPLORATION_ORIGIN,
    });
  }

  function submitSearch(query = draftQuery) {
    const next = query.trim();
    setDraftQuery(next);
    dispatch({ type: 'set_query', query: next });
  }

  if (!neighborhood.effectiveLocation) {
    return (
      <ScreenFrame
        title="Negocios"
        subtitle="Encuentra lugares y servicios útiles sin tener que compartir tu ubicación"
        action={
          <Pressable
            onPress={() => router.push('/business/register')}
            style={{ paddingVertical: paltaTheme.spacing.xs }}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>Mi negocio</Text>
          </Pressable>
        }
      >
        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
            ¿Qué necesitas cerca?
          </Text>
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 21 }}>
            Puedes buscar desde tu ubicación o empezar explorando Santiago. Tu ubicación exacta no es obligatoria para usar esta sección.
          </Text>

          <Pressable
            disabled={locationBusy}
            onPress={() => void useMyLocation()}
            style={{
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.control,
              paddingHorizontal: paltaTheme.spacing.sm,
              paddingVertical: paltaTheme.spacing.sm,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text style={{ fontWeight: '800', opacity: locationBusy ? 0.5 : 1 }}>
              {locationBusy ? 'Buscando…' : 'Buscar cerca de mí'}
            </Text>
          </Pressable>

          <Pressable
            onPress={exploreSantiago}
            style={{
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.control,
              paddingHorizontal: paltaTheme.spacing.sm,
              paddingVertical: paltaTheme.spacing.sm,
              backgroundColor: paltaTheme.color.surface,
            }}
          >
            <Text style={{ fontWeight: '800' }}>Explorar Santiago</Text>
            <Text style={{ marginTop: paltaTheme.spacing.xxs, color: paltaTheme.color.textSecondary }}>
              Después puedes mover el mapa y buscar en otra zona.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/local-businesses/following')}
            style={{ paddingVertical: paltaTheme.spacing.xs }}
          >
            <Text style={{ fontWeight: '800' }}>Ver negocios que sigo</Text>
          </Pressable>

          {locationError ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>{locationError}</Text>
          ) : null}
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Negocios"
      subtitle="Busca por lo que necesitas y mira qué puedes usar ahora"
      scroll={false}
      action={
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm, alignItems: 'center' }}>
          <Pressable
            onPress={() => router.push('/local-businesses/following')}
            style={{ paddingVertical: paltaTheme.spacing.xs }}
          >
            <Text style={{ fontWeight: '800' }}>Siguiendo</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/business/register')}
            style={{ paddingVertical: paltaTheme.spacing.xs }}
          >
            <Text style={{ fontWeight: '800' }}>Mi negocio</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, marginBottom: 10 }}>
          <TextInput
            value={draftQuery}
            onChangeText={setDraftQuery}
            onSubmitEditing={() => submitSearch()}
            placeholder="Ej. gasfiter, corte de pelo, neumáticos"
            placeholderTextColor={paltaTheme.color.textMuted}
            returnKeyType="search"
            style={{
              flex: 1,
              minHeight: paltaTheme.touch.minimum,
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.control,
              paddingHorizontal: paltaTheme.spacing.sm,
              paddingVertical: paltaTheme.spacing.xs,
              backgroundColor: paltaTheme.color.surface,
              color: paltaTheme.color.textPrimary,
            }}
          />
          <Pressable
            onPress={() => submitSearch()}
            style={{
              minHeight: paltaTheme.touch.minimum,
              borderRadius: paltaTheme.radius.control,
              paddingHorizontal: paltaTheme.spacing.sm,
              justifyContent: 'center',
              backgroundColor: paltaTheme.color.brandPrimary,
            }}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.surface }}>Buscar</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs, marginBottom: 10 }}>
          {LOCAL_BUSINESS_SHORTCUTS.map((shortcut) => (
            <FilterChip
              key={shortcut.id}
              label={shortcut.label}
              selected={neighborhood.query === shortcut.query}
              onPress={() => submitSearch(shortcut.query)}
            />
          ))}
        </View>

        <View style={{ minHeight: 230, flex: 1 }}>
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
                borderWidth: 1,
                borderColor: paltaTheme.color.border,
                backgroundColor: paltaTheme.color.surfaceMuted,
              }}
            >
              <Text style={{ color: paltaTheme.color.textPrimary }}>Map Core preparado</Text>
              <Text style={{ marginTop: 6, color: paltaTheme.color.textSecondary }}>
                Falta conectar el estilo de mapa del runtime.
              </Text>
            </View>
          )}

          {neighborhood.mapMovedSinceSearch ? (
            <Pressable
              onPress={() =>
                dispatch({
                  type: 'search_current_viewport',
                  resultIds: businesses.map((item) => item.entity_id),
                })
              }
              style={{
                position: 'absolute',
                alignSelf: 'center',
                top: 14,
                minHeight: paltaTheme.touch.minimum,
                paddingHorizontal: paltaTheme.spacing.sm,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: paltaTheme.color.border,
                borderRadius: paltaTheme.radius.pill,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Buscar en esta zona
              </Text>
            </Pressable>
          ) : null}
        </View>

        <MapResultSheet
          snap={neighborhood.sheetSnap}
          onSnapChange={(snap) => dispatch({ type: 'set_sheet_snap', snap })}
        >
          {selectedBusiness ? (
            <View style={{ marginBottom: paltaTheme.spacing.sm, gap: paltaTheme.spacing.xs }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: paltaTheme.color.textMuted,
                }}
              >
                SELECCIONADO EN EL MAPA
              </Text>
              <LocalResultCard
                selected
                name={selectedBusiness.name}
                meta={[
                  formatOperationalState(selectedBusiness.operational_state, selectedBusiness.next_open_at),
                  selectedBusiness.category_key,
                  selectedBusiness.verification_status === 'verified' ? 'Verificado' : undefined,
                ].filter(Boolean).join(' · ')}
                distance={selectedBusiness.location
                  ? formatDistance(selectedBusiness.distance_m)
                  : 'Zona de atención'}
                onPress={() => openBusiness(selectedBusiness.entity_id)}
              />
              <Pressable
                onPress={() => dispatch({ type: 'select_entity', entityId: null })}
                style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontWeight: '700', color: paltaTheme.color.textSecondary }}>
                  Cerrar selección
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: paltaTheme.spacing.xs,
              paddingBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.textMuted }}>
              {neighborhood.query ? 'RESULTADOS' : 'NEGOCIOS CERCA'}
            </Text>
            <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
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
            </View>
          </View>

          {state.status === 'loading' && !state.data ? <LoadingState label="Buscando negocios…" /> : null}
          {state.status === 'error' && !state.data ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}
          {businesses.length === 0 && state.status !== 'loading' ? (
            <EmptyState
              title="No encontramos negocios para esta búsqueda"
              body={openNowOnly
                ? 'No encontramos negocios confirmados como abiertos ahora en esta búsqueda. Quita el filtro para ver más opciones.'
                : 'Prueba con otra palabra o mueve el mapa. Las búsquedas sin resultado también nos ayudan a mejorar la clasificación local.'}
            />
          ) : null}

          {businesses
            .filter((item) => item.entity_id !== selectedBusiness?.entity_id)
            .map((item) => (
              <LocalResultCard
                key={item.entity_id}
                name={item.name}
                meta={[
                  formatOperationalState(item.operational_state, item.next_open_at),
                  item.category_key,
                  item.verification_status === 'verified' ? 'Verificado' : undefined,
                ].filter(Boolean).join(' · ')}
                distance={item.location ? formatDistance(item.distance_m) : 'Zona de atención'}
                onPress={() => openBusiness(item.entity_id)}
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
