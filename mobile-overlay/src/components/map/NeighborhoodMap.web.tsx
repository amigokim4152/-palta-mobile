import { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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

const SOURCE_ID = 'palta-local-entities';
const CLUSTER_LAYER_ID = 'palta-local-clusters';
const CLUSTER_COUNT_LAYER_ID = 'palta-local-cluster-count';
const POINT_LAYER_ID = 'palta-local-points';
const SELECTED_POINT_LAYER_ID = 'palta-local-selected-point';

function featureAt(event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) {
  return event.features?.[0];
}

export function NeighborhoodMap({
  mapStyle,
  features,
  initialCenter,
  initialZoom = 14,
  onSelectEntity,
  onViewportChanged,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const onViewportChangedRef = useRef(onViewportChanged);

  onSelectEntityRef.current = onSelectEntity;
  onViewportChangedRef.current = onViewportChanged;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: initialZoom,
      attributionControl: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toPointFeatureCollection(features),
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 15,
      });

      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'selected'], true]],
        paint: {
          'circle-radius': 8,
          'circle-color': paltaTheme.color.brandPrimary,
          'circle-stroke-width': 2,
          'circle-stroke-color': paltaTheme.color.surface,
        },
      });

      map.addLayer({
        id: SELECTED_POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
        paint: {
          'circle-radius': 12,
          'circle-color': paltaTheme.color.brandFresh,
          'circle-stroke-width': 4,
          'circle-stroke-color': paltaTheme.color.surface,
        },
      });

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 25],
          'circle-color': paltaTheme.color.brandPrimary,
          'circle-stroke-width': 2,
          'circle-stroke-color': paltaTheme.color.surface,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: {
          'text-color': paltaTheme.color.surface,
        },
      });

      map.on('click', CLUSTER_LAYER_ID, async (event) => {
        const feature = featureAt(event);
        const clusterId = feature?.properties?.cluster_id;
        if (typeof clusterId !== 'number' || feature?.geometry.type !== 'Point') return;

        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
          duration: 220,
        });
      });

      const handlePointClick = (event: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const feature = featureAt(event);
        const entityId = feature?.properties?.entityId;
        if (typeof entityId !== 'string' || feature?.geometry.type !== 'Point') return;

        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          padding: { top: 28, right: 24, bottom: 176, left: 24 },
          duration: 180,
        });
        onSelectEntityRef.current?.(entityId);
      };

      map.on('click', POINT_LAYER_ID, handlePointClick);
      map.on('click', SELECTED_POINT_LAYER_ID, handlePointClick);

      for (const layerId of [POINT_LAYER_ID, SELECTED_POINT_LAYER_ID, CLUSTER_LAYER_ID]) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    });

    map.on('moveend', (event) => {
      const center = map.getCenter();
      onViewportChangedRef.current?.(
        { latitude: center.lat, longitude: center.lng },
        map.getZoom(),
        Boolean(event.originalEvent),
      );
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [initialCenter.latitude, initialCenter.longitude, initialZoom, mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toPointFeatureCollection(features));
  }, [features]);

  return (
    <div
      ref={containerRef}
      aria-label="Mapa de negocios y servicios cercanos"
      style={{ width: '100%', height: '100%', minHeight: 320 }}
    />
  );
}
