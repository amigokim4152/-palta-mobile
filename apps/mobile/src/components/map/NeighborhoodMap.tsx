import { useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
  type MapRef,
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
  const mapRef = useRef<MapRef>(null);
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
    <View style={{ flex: 1 }}>
      <Map
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        attribution={false}
        logo={false}
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

        <GeoJSONSource id="palta-active-location" data={activeLocationData}>
          <Layer
            id="palta-active-location-halo"
            type="circle"
            paint={{
              'circle-color': '#FFFFFF',
              'circle-radius': 12,
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
              'circle-radius': 6.5,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </Map>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Información y atribución del mapa"
        hitSlop={8}
        onPress={() => void mapRef.current?.showAttribution()}
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: 'rgba(52,66,57,0.20)',
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#4B5A51' }}>i</Text>
      </Pressable>
    </View>
  );
}
