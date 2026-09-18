import type { ComponentProps } from 'react';
import { Map } from '@maplibre/maplibre-react-native';

type MapStyle = Exclude<ComponentProps<typeof Map>['mapStyle'], string>;

const SANTIAGO_PMTILES_URL =
  'pmtiles://https://palta-edge-preflight.kimeuisin.workers.dev/maps/santiago.pmtiles';

export const PALTA_DEVELOPMENT_MAP_STYLE: MapStyle = {
  version: 8,
  name: 'Palta Santiago Development',
  sources: {
    paltaSantiago: {
      type: 'vector',
      url: SANTIAGO_PMTILES_URL,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#F6F4EF' },
    },
    {
      id: 'earth',
      type: 'fill',
      source: 'paltaSantiago',
      'source-layer': 'earth',
      paint: { 'fill-color': '#F6F4EF' },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'paltaSantiago',
      'source-layer': 'landcover',
      paint: { 'fill-color': '#E8EFE3', 'fill-opacity': 0.65 },
    },
    {
      id: 'landuse',
      type: 'fill',
      source: 'paltaSantiago',
      'source-layer': 'landuse',
      paint: { 'fill-color': '#EEECE4', 'fill-opacity': 0.55 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'paltaSantiago',
      'source-layer': 'water',
      paint: { 'fill-color': '#BFDCE8' },
    },
    {
      id: 'boundaries',
      type: 'line',
      source: 'paltaSantiago',
      'source-layer': 'boundaries',
      paint: { 'line-color': '#C8C4BA', 'line-width': 0.8 },
    },
    {
      id: 'roads',
      type: 'line',
      source: 'paltaSantiago',
      'source-layer': 'roads',
      paint: {
        'line-color': '#D2CEC3',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          0.6,
          14,
          2.2,
          17,
          5,
        ],
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'paltaSantiago',
      'source-layer': 'buildings',
      minzoom: 13,
      paint: {
        'fill-color': '#D8D3C8',
        'fill-outline-color': '#C9C3B7',
      },
    },
  ],
};
