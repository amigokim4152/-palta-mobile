import type { ExpoConfig } from 'expo/config';

const webBaseUrl =
  process.env.PALTA_WEB_BASE_URL ?? process.env.EXPO_PUBLIC_PALTA_WEB_BASE_URL;

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
  web: {
    bundler: 'metro',
    output: 'single',
  },
  experiments: {
    typedRoutes: true,
    ...(webBaseUrl ? { baseUrl: webBaseUrl } : {}),
  },
};

export default config;
