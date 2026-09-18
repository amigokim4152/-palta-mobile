import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from '@maplibre/maplibre-react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import { toPointFeatureCollection } from '../../../../src/map/mapFeatureCollection';

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
  );
}
