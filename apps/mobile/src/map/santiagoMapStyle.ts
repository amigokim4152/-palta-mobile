export function createSantiagoMapStyle(pmtilesSource: string) {
  return {
    version: 8 as const,
    sources: {
      santiago: {
        type: 'vector' as const,
        url: pmtilesSource,
      },
    },
    layers: [
      {
        id: 'earth',
        type: 'background' as const,
        paint: {
          'background-color': '#f3f1eb',
        },
      },
      {
        id: 'landcover',
        type: 'fill' as const,
        source: 'santiago',
        'source-layer': 'landcover',
        paint: {
          'fill-color': '#e4eadc',
          'fill-opacity': 0.65,
        },
      },
      {
        id: 'landuse',
        type: 'fill' as const,
        source: 'santiago',
        'source-layer': 'landuse',
        paint: {
          'fill-color': '#ebe8df',
          'fill-opacity': 0.55,
        },
      },
      {
        id: 'water',
        type: 'fill' as const,
        source: 'santiago',
        'source-layer': 'water',
        paint: {
          'fill-color': '#b9d9e8',
        },
      },
      {
        id: 'buildings',
        type: 'fill' as const,
        source: 'santiago',
        'source-layer': 'buildings',
        minzoom: 13,
        paint: {
          'fill-color': '#d8d3c9',
          'fill-opacity': 0.8,
        },
      },
      {
        id: 'roads',
        type: 'line' as const,
        source: 'santiago',
        'source-layer': 'roads',
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0.5,
            12, 1.5,
            15, 4,
          ],
        },
      },
      {
        id: 'boundaries',
        type: 'line' as const,
        source: 'santiago',
        'source-layer': 'boundaries',
        paint: {
          'line-color': '#9b9b95',
          'line-width': 1,
          'line-opacity': 0.55,
        },
      },
    ],
  };
}
