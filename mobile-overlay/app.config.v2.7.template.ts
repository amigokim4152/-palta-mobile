import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Palta',
  slug: 'palta',
  scheme: 'palta',
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permite que Palta use tu ubicación mientras usas la app para mostrar lugares y servicios cercanos.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          enableSceneSupport: true,
        },
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
  ios: {
    bundleIdentifier: 'cl.somospalta.app',
  },
  android: {
    package: 'cl.somospalta.app',
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
