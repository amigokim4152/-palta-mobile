import type { ExpoConfig } from 'expo/config';

const webBaseUrl =
  process.env.PALTA_WEB_BASE_URL ?? process.env.EXPO_PUBLIC_PALTA_WEB_BASE_URL;

const config: ExpoConfig = {
  name: 'Palta',
  slug: 'palta',
  scheme: 'palta',
  plugins: [
    'expo-router',
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
    '@maplibre/maplibre-react-native',
    [
      'expo-build-properties',
      {
        ios: { enableSceneSupport: true },
      },
    ],
  ],
  ios: { bundleIdentifier: 'cl.somospalta.app' },
  android: { package: 'cl.somospalta.app' },
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
