import { useEffect, useRef } from 'react';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import { toPointFeatureCollection } from '../../../../src/map/mapFeatureCollection';
import { paltaTheme } from '../../theme/paltaTheme';

type Props = {
  mapStyle: string;
  features: readonly MapFeature[];
  initialCenter: {
    latitude: number;
    longitude: number;
  };
  initialZoom?: number;
  onSelectEntity?: (entityId: string) => void;
  onViewportChanged?: (
    center: { latitude: number; longitude: number },
    zoom: number,
    userInteraction: boolean,
  ) => void;
};

const SELECTION_PADDING = {
  top: 28,
  right: 24,
  bottom: 176,
  left: 24,
} as const;

export function NeighborhoodMap({
  mapStyle,
  features,
  initialCenter,
  initialZoom = 14,
  onSelectEntity,
  onViewportChanged,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const data = toPointFeatureCollection(features);

  useEffect(() => {
    cameraRef.current?.easeTo({
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: initialZoom,
      duration: 240,
      easing: 'ease',
    });
  }, [initialCenter.latitude, initialCenter.longitude, initialZoom]);

  return (
    <Map
      style={{ flex: 1 }}
      mapStyle={mapStyle}
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
        ref={cameraRef}
        initialViewState={{
          center: [initialCenter.longitude, initialCenter.latitude],
          zoom: initialZoom,
        }}
      />

      <GeoJSONSource
        ref={sourceRef}
        id="palta-local-entities"
        data={data}
        cluster
        clusterRadius={42}
        clusterMaxZoom={15}
        onPress={(event) => {
          const feature = event.nativeEvent.features?.[0];
          if (!feature) return;

          const clusterId = feature.properties?.cluster_id;
          if (
            typeof clusterId === 'number' &&
            feature.geometry?.type === 'Point' &&
            Array.isArray(feature.geometry.coordinates)
          ) {
            const coordinates = feature.geometry.coordinates;
            void sourceRef.current
              ?.getClusterExpansionZoom(clusterId)
              .then((zoom) => {
                cameraRef.current?.easeTo({
                  center: [Number(coordinates[0]), Number(coordinates[1])],
                  zoom,
                  duration: 220,
                  easing: 'ease',
                });
              });
            return;
          }

          const entityId = feature.properties?.entityId;
          if (
            typeof entityId === 'string' &&
            feature.geometry?.type === 'Point' &&
            Array.isArray(feature.geometry.coordinates)
          ) {
            const coordinates = feature.geometry.coordinates;
            cameraRef.current?.easeTo({
              center: [Number(coordinates[0]), Number(coordinates[1])],
              padding: SELECTION_PADDING,
              duration: 180,
              easing: 'ease',
            });
            onSelectEntity?.(entityId);
          }
        }}
      >
        <Layer
          id="palta-local-points"
          type="circle"
          filter={[
            'all',
            ['!', ['has', 'point_count']],
            ['!=', ['get', 'selected'], true],
          ]}
          paint={{
            'circle-radius': 8,
            'circle-color': paltaTheme.color.brandPrimary,
            'circle-stroke-width': 2,
            'circle-stroke-color': paltaTheme.color.surface,
          }}
        />
        <Layer
          id="palta-local-selected-point"
          type="circle"
          filter={[
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'selected'], true],
          ]}
          paint={{
            'circle-radius': 12,
            'circle-color': paltaTheme.color.brandFresh,
            'circle-stroke-width': 4,
            'circle-stroke-color': paltaTheme.color.surface,
          }}
        />
        <Layer
          id="palta-local-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              10,
              20,
              50,
              25,
            ],
            'circle-color': paltaTheme.color.brandPrimary,
            'circle-stroke-width': 2,
            'circle-stroke-color': paltaTheme.color.surface,
          }}
        />
        <Layer
          id="palta-local-cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
            'text-font': ['Noto Sans'],
          }}
          paint={{ 'text-color': paltaTheme.color.surface }}
        />
      </GeoJSONSource>
    </Map>
  );
}
