import { useState, type ComponentProps } from 'react';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native';
import { Text, View } from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import { toPointFeatureCollection } from '../../../../src/map/mapFeatureCollection';

type Props = {
  mapStyle: ComponentProps<typeof Map>['mapStyle'];
  features: readonly MapFeature[];
  initialCenter: {
    latitude: number;
    longitude: number;
  };
  initialZoom?: number;
  showLoadStatus?: boolean;
  onSelectEntity?: (entityId: string) => void;
  onViewportChanged?: (
    center: { latitude: number; longitude: number },
    zoom: number,
    userInteraction: boolean,
  ) => void;
};

export function NeighborhoodMap({
  mapStyle,
  features,
  initialCenter,
  initialZoom = 14,
  showLoadStatus = false,
  onSelectEntity,
  onViewportChanged,
}: Props) {
  const data = toPointFeatureCollection(features);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );

  const statusLabel =
    loadStatus === 'ready'
      ? 'Mapa cargado'
      : loadStatus === 'failed'
        ? 'Error al cargar mapa'
        : 'Cargando mapa…';

  return (
    <View style={{ flex: 1 }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        onWillStartLoadingMap={() => setLoadStatus('loading')}
        onDidFinishLoadingMap={() => setLoadStatus('ready')}
        onDidFailLoadingMap={() => setLoadStatus('failed')}
        onRegionDidChange={(event) => {
          const [longitude, latitude] = event.nativeEvent.center;
          onViewportChanged?.(
            { latitude, longitude },
            event.nativeEvent.zoom,
            event.nativeEvent.userInteraction,
          );
        }}
      >
        <Camera
          initialViewState={{
            center: [initialCenter.longitude, initialCenter.latitude],
            zoom: initialZoom,
          }}
        />

        <GeoJSONSource
          id="palta-local-entities"
          data={data}
          cluster
          clusterRadius={42}
          onPress={(event) => {
            const feature = event.nativeEvent.features?.[0];
            const entityId = feature?.properties?.entityId;
            if (typeof entityId === 'string') {
              onSelectEntity?.(entityId);
            }
          }}
        >
          <Layer
            id="palta-local-points"
            type="circle"
            filter={['!', ['has', 'point_count']]}
          />
          <Layer
            id="palta-local-clusters"
            type="circle"
            filter={['has', 'point_count']}
          />
        </GeoJSONSource>
      </Map>

      {showLoadStatus ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.92)',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700' }}>{statusLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
