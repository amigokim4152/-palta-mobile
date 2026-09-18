import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
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

export function NeighborhoodMap({
  mapStyle,
  features,
  initialCenter,
  initialZoom = 14,
  onSelectEntity,
  onViewportChanged,
}: Props) {
  const data = toPointFeatureCollection(features);

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
        initialViewState={{
          center: [initialCenter.longitude, initialCenter.latitude],
          zoom: initialZoom,
        }}
      />

      <GeoJSONSource
        id="palta-local-entities"
        data={data}
        cluster
        clusterRadius={46}
        onPress={(event) => {
          const feature = event.nativeEvent.features?.[0];
          const entityId = feature?.properties?.entityId;
          if (typeof entityId === 'string') {
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
              12,
              10,
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
              8,
              6.5,
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
              16,
              10,
              20,
              50,
              24,
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
              12,
              10,
              16,
              50,
              20,
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
