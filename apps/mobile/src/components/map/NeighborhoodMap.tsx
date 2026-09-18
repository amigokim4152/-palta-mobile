import { useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// MapLibre's RN typings model style expressions as mutable tuples. Keep these
// expressions mutable at the type boundary so strict TypeScript does not turn
// valid style expressions into incompatible readonly tuples.
const CATEGORY_MARKER_LABEL: any = [
  'match',
  ['get', 'categoryKey'],
  'auto_repair',
  '⚙',
  'home_repair',
  '⚒',
  'pharmacy',
  '✚',
  'clinic',
  '✚',
  'cesfam',
  '✚',
  'hospital',
  '✚',
  'restaurant',
  '🍴',
  'cafe',
  '☕',
  'bakery',
  '🍞',
  'grocery',
  '🛒',
  'supermarket',
  '🛒',
  'feria',
  '🛒',
  'pet',
  '🐾',
  'veterinary',
  '🐾',
  'school',
  '✎',
  'education',
  '✎',
  'university',
  '✎',
  'hotel',
  '⌂',
  'beauty',
  '✂',
  'barber',
  '✂',
  'municipality',
  '⚑',
  'townhall',
  '⚑',
  'metro',
  'Ⓜ',
  'metro_station',
  'Ⓜ',
  'station',
  '↔',
  'bus_stop',
  '↔',
  'public_transport',
  '↔',
  'fuel',
  '⛽',
  'police',
  '⚑',
  'fire_station',
  '✦',
  'park',
  '♣',
  'plaza',
  '♣',
  'service',
  '•',
  '•',
];

const ENTITY_MARKER_COLOR: any = [
  'case',
  ['==', ['get', 'selected'], true],
  paltaTheme.color.brandFresh,
  [
    'match',
    ['get', 'entityType'],
    'business',
    paltaTheme.color.brandPrimary,
    'public_service',
    paltaTheme.color.info,
    'event',
    '#A96414',
    'place',
    '#59655E',
    paltaTheme.color.brandPrimary,
  ],
];

const OPERATIONAL_OPACITY: any = [
  'match',
  ['get', 'operationalState'],
  ['closed_now', 'closed', 'temporarily_closed'],
  0.56,
  0.98,
];

const TIER_VISIBILITY: any = [
  'case',
  ['==', ['get', 'selected'], true],
  1,
  ['==', ['get', 'markerTier'], 'anchor'],
  ['step', ['zoom'], 0, 12.4, 1],
  ['==', ['get', 'markerTier'], 'local'],
  ['step', ['zoom'], 0, 13.6, 1],
  ['step', ['zoom'], 0, 14.6, 1],
];

const MARKER_OPACITY: any = ['*', OPERATIONAL_OPACITY, TIER_VISIBILITY];

const MARKER_OUTER_RADIUS: any = [
  'case',
  ['==', ['get', 'selected'], true],
  16,
  ['==', ['get', 'markerTier'], 'anchor'],
  ['step', ['zoom'], 0, 12.4, 12],
  ['==', ['get', 'markerTier'], 'local'],
  ['step', ['zoom'], 0, 13.6, 11.5],
  ['step', ['zoom'], 0, 14.6, 11],
];

const MARKER_INNER_RADIUS: any = [
  'case',
  ['==', ['get', 'selected'], true],
  11,
  ['==', ['get', 'markerTier'], 'anchor'],
  ['step', ['zoom'], 0, 12.4, 8.5],
  ['==', ['get', 'markerTier'], 'local'],
  ['step', ['zoom'], 0, 13.6, 8],
  ['step', ['zoom'], 0, 14.6, 7.5],
];

const MARKER_TEXT_SIZE: any = [
  'case',
  ['==', ['get', 'selected'], true],
  11.5,
  ['==', ['get', 'markerTier'], 'anchor'],
  ['step', ['zoom'], 0, 12.4, 9.5],
  ['==', ['get', 'markerTier'], 'local'],
  ['step', ['zoom'], 0, 13.6, 9.2],
  ['step', ['zoom'], 0, 14.6, 9],
];

export function NeighborhoodMap({
  mapStyle,
  features,
  initialCenter,
  initialZoom = 14,
  onSelectEntity,
  onViewportChanged,
}: Props) {
  const insets = useSafeAreaInsets();
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
          clusterMaxZoom={13}
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
              'circle-radius': MARKER_OUTER_RADIUS,
              'circle-opacity': TIER_VISIBILITY,
              'circle-stroke-color': 'rgba(24,32,27,0.08)',
              'circle-stroke-width': 1,
            }}
          />
          <Layer
            id="palta-local-points"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ENTITY_MARKER_COLOR,
              'circle-radius': MARKER_INNER_RADIUS,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.4,
              'circle-opacity': MARKER_OPACITY,
            }}
          />
          <Layer
            id="palta-local-category-mark"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            layout={{
              'text-field': CATEGORY_MARKER_LABEL,
              'text-font': ['Noto Sans Symbols 2'],
              'text-size': MARKER_TEXT_SIZE,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': '#FFFFFF',
              'text-opacity': MARKER_OPACITY,
            }}
          />
          <Layer
            id="palta-local-verified-mark"
            type="symbol"
            minzoom={13.6}
            filter={[
              'all',
              ['!', ['has', 'point_count']],
              ['==', ['get', 'verificationStatus'], 'verified'],
            ]}
            layout={{
              'text-field': '✓',
              'text-font': ['Noto Sans'],
              'text-size': 10,
              'text-offset': [0.85, -0.85],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': paltaTheme.color.brandFresh,
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2,
              'text-opacity': TIER_VISIBILITY,
            }}
          />
          <Layer
            id="palta-local-selected-label"
            type="symbol"
            filter={[
              'all',
              ['!', ['has', 'point_count']],
              ['==', ['get', 'selected'], true],
            ]}
            layout={{
              'text-field': ['get', 'title'],
              'text-font': ['Noto Sans'],
              'text-size': 12,
              'text-offset': [0, -1.7],
              'text-anchor': 'bottom',
              'text-max-width': 12,
              'text-padding': 4,
              'text-optional': true,
            }}
            paint={{
              'text-color': paltaTheme.color.textPrimary,
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 2.4,
              'text-halo-blur': 0.4,
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
                18,
                10,
                22,
                50,
                26,
              ],
              'circle-opacity': 0.98,
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
                14,
                10,
                18,
                50,
                22,
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1.5,
              'circle-opacity': 0.96,
            }}
          />
          <Layer
            id="palta-local-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Noto Sans'],
              'text-size': 11,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            }}
            paint={{
              'text-color': '#FFFFFF',
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
              'circle-opacity': 0.99,
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
        accessibilityLabel="Volver a mi ubicación"
        hitSlop={10}
        onPress={() =>
          cameraRef.current?.easeTo({
            center: [initialCenter.longitude, initialCenter.latitude],
            duration: 220,
            easing: 'ease',
          })
        }
        style={{
          position: 'absolute',
          right: 8,
          top: insets.top + 34,
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderWidth: 1,
          borderColor: 'rgba(52,66,57,0.16)',
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: 18, lineHeight: 20, color: '#315A86' }}>◎</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Información y atribución del mapa"
        hitSlop={12}
        onPress={() => void mapRef.current?.showAttribution()}
        style={{
          position: 'absolute',
          right: 10,
          top: insets.top + 8,
          width: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderWidth: 1,
          borderColor: 'rgba(52,66,57,0.16)',
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#4B5A51' }}>i</Text>
      </Pressable>
    </View>
  );
}
