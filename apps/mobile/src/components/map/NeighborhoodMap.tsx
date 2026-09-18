import { useMemo, useRef } from 'react';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import type { MapFeature } from '../../../../../src/adapters/mapCore';
import { toPointFeatureCollection } from '../../../../../src/map/mapFeatureCollection';
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
  const activeLocationData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [initialCenter.longitude, initialCenter.latitude] as [
              number,
              number,
            ],
          },
          properties: {},
        },
      ],
    }),
    [initialCenter.latitude, initialCenter.longitude],
  );

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

      <GeoJSONSource id="palta-active-location" data={activeLocationData}>
        <Layer
          id="palta-active-location-halo"
          type="circle"
          paint={{
            'circle-color': '#FFFFFF',
            'circle-radius': 11,
            'circle-opacity': 0.98,
            'circle-stroke-color': '#D8E5F2',
            'circle-stroke-width': 1,
          }}
        />
        <Layer
          id="palta-active-location-dot"
          type="circle"
          paint={{
            'circle-color': '#2F7DD1',
            'circle-radius': 6,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.5,
          }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        ref={sourceRef}
        id="palta-local-entities"
        data={data}
        cluster
        clusterRadius={46}
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
          id="palta-local-point-halo"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': '#FFFFFF',
            'circle-radius': [
              'case',
              ['==', ['get', 'selected'], true],
              14,
              11,
            ],
            'circle-opacity': 0.96,
          }}
        />
        <Layer
          id="palta-local-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': [
              'case',
              ['==', ['get', 'selected'], true],
              paltaTheme.color.brandFresh,
              paltaTheme.color.brandPrimary,
            ],
            'circle-radius': [
              'case',
              ['==', ['get', 'selected'], true],
              9,
              7,
            ],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.5,
          }}
        />
        <Layer
          id="palta-local-cluster-halo"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#FFFFFF',
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              17,
              10,
              21,
              50,
              25,
            ],
            'circle-opacity': 0.96,
          }}
        />
        <Layer
          id="palta-local-clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': paltaTheme.color.brandPrimary,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              13,
              10,
              17,
              50,
              21,
            ],
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.96,
          }}
        />
      </GeoJSONSource>
    </Map>
  );
}
