import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import {
  LOCAL_BUSINESS_SHORTCUTS,
  projectLocalBusinesses,
} from '../../../../src/business/localBusinessDiscovery';
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

function formatDistance(distanceM?: number): string | undefined {
  if (distanceM === undefined) return undefined;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

export function LocalBusinessDiscoveryScreen() {
  const { state: neighborhood, dispatch } = useNeighborhoodState();
  const [draftQuery, setDraftQuery] = useState(neighborhood.query);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const searchPoint = neighborhood.searchOrigin ?? neighborhood.effectiveLocation;

  const loadResults = useCallback(async () => {
    if (!searchPoint) return [];
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.searchLocal({
      latitude: searchPoint.latitude,
      longitude: searchPoint.longitude,
      ...(neighborhood.query ? { query: neighborhood.query } : {}),
    });
  }, [searchPoint?.latitude, searchPoint?.longitude, neighborhood.query]);

  const { state, refresh } = useAsyncResource(loadResults, {
    enabled: searchPoint !== null,
    isEmpty: (items) => items.length === 0,
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
        location: item.location,
        source: item,
      })),
      { verifiedOnly },
    );
    return projected.map((item) => item.source);
  }, [state.data, verifiedOnly]);

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      businesses.map((item) => ({
        id: item.entity_id,
        entityType: 'business',
        coordinate: {
          latitude: item.location.lat,
          longitude: item.location.lng,
        },
        title: item.name,
        ...(item.category_key ? { categoryKey: item.category_key } : {}),
        selected: item.entity_id === neighborhood.selectedEntityId,
      })),
    [businesses, neighborhood.selectedEntityId],
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
        setLocationError('Puedes explorar otra zona sin compartir tu ubicación.');
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

  function submitSearch(query = draftQuery) {
    const next = query.trim();
    setDraftQuery(next);
    dispatch({ type: 'set_query', query: next });
  }

  if (!neighborhood.effectiveLocation) {
    return (
      <ScreenFrame title="Negocios cerca" subtitle="Servicios y comercios de tu zona">
        <Text style={{ fontSize: 20, fontWeight: '800' }}>¿Qué necesitas?</Text>
        <Text style={{ marginTop: 8, opacity: 0.66 }}>
          Usa tu ubicación sólo para buscar cerca. También podrás explorar otra zona en el mapa.
        </Text>
        <Pressable
          disabled={locationBusy}
          onPress={() => void useMyLocation()}
          style={{ paddingVertical: 14, marginTop: 10 }}
        >
          <Text style={{ fontWeight: '800', opacity: locationBusy ? 0.5 : 1 }}>
            {locationBusy ? 'Buscando…' : 'Usar mi ubicación'}
          </Text>
        </Pressable>
        {locationError ? <Text style={{ opacity: 0.66 }}>{locationError}</Text> : null}
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Negocios cerca"
      subtitle="Busca por lo que necesitas, no por nuestra clasificación"
      scroll={false}
      action={
        <Pressable onPress={() => router.push('/business/register')} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Mi negocio</Text>
        </Pressable>
      }
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput
            value={draftQuery}
            onChangeText={setDraftQuery}
            onSubmitEditing={() => submitSearch()}
            placeholder="Ej. gasfiter, corte de pelo, neumáticos"
            returnKeyType="search"
            style={{ flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}
          />
          <Pressable
            onPress={() => submitSearch()}
            style={{ borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center' }}
          >
            <Text style={{ fontWeight: '800' }}>Buscar</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
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
              initialCenter={neighborhood.effectiveLocation}
              onSelectEntity={(entityId) => dispatch({ type: 'select_entity', entityId })}
              onViewportChanged={(center, zoom, userInteraction) =>
                dispatch({ type: 'set_viewport_center', center, zoom, userInteraction })
              }
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }}>
              <Text>Map Core preparado</Text>
              <Text style={{ marginTop: 6, opacity: 0.6 }}>Falta conectar el estilo de mapa del runtime.</Text>
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
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderWidth: 1,
                borderRadius: 999,
                backgroundColor: 'white',
              }}
            >
              <Text style={{ fontWeight: '800' }}>Buscar en esta zona</Text>
            </Pressable>
          ) : null}
        </View>

        <MapResultSheet
          snap={neighborhood.sheetSnap}
          onSnapChange={(snap) => dispatch({ type: 'set_sheet_snap', snap })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', opacity: 0.6 }}>
              {neighborhood.query ? 'RESULTADOS' : 'NEGOCIOS CERCA'}
            </Text>
            <FilterChip
              label="Verificados"
              selected={verifiedOnly}
              onPress={() => setVerifiedOnly((value) => !value)}
            />
          </View>

          {state.status === 'loading' && !state.data ? <LoadingState label="Buscando negocios…" /> : null}
          {state.status === 'error' && !state.data ? (
            <ErrorState message={state.message} onRetry={() => void refresh()} />
          ) : null}
          {businesses.length === 0 && state.status !== 'loading' ? (
            <EmptyState
              title="No encontramos negocios para esta búsqueda"
              body="Prueba con otra palabra o mueve el mapa. Las búsquedas sin resultado también nos ayudan a mejorar la clasificación local."
            />
          ) : null}

          {businesses.map((item) => (
            <LocalResultCard
              key={item.entity_id}
              name={item.name}
              meta={[
                item.category_key,
                item.verification_status === 'verified' ? 'Verificado' : undefined,
              ].filter(Boolean).join(' · ')}
              distance={formatDistance(item.distance_m)}
              onPress={() => {
                dispatch({ type: 'select_entity', entityId: item.entity_id });
                router.push(`/business/${encodeURIComponent(item.entity_id)}`);
              }}
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
