import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Somos Palta',
  slug: 'somos-palta',
  scheme: 'palta',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Permite que Somos Palta use tu ubicación mientras usas la app para mostrar lugares y servicios cercanos.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    '@maplibre/maplibre-react-native',
  ],
  ios: {
    bundleIdentifier: 'cl.somospalta.app',
    supportsTablet: true,
  },
  android: {
    package: 'cl.somospalta.app',
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
