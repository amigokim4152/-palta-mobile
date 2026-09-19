export type RuntimeEnv = {
  apiBaseUrl: string;
  publicDataApiBaseUrl?: string;
  mapStyleUrl?: string;
  environment: 'development' | 'preview' | 'production';
};

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length != 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function validatedUrl(
  value: string | undefined,
  name: string,
  environment: RuntimeEnv['environment'],
): string {
  if (!value) throw new Error(`${name} is required`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const privateLan = isPrivateIpv4(url.hostname);

  if (url.protocol !== 'https:') {
    const allowedDevHttp =
      environment === 'development' && (localhost || privateLan);
    if (!allowedDevHttp) {
      throw new Error(
        `${name} must use HTTPS outside localhost/private development LAN`,
      );
    }
  }

  return value.replace(/\/$/, '');
}

export function parseRuntimeEnv(
  input: Record<string, string | undefined>,
): RuntimeEnv {
  const rawEnvironment = input.EXPO_PUBLIC_ENV ?? 'development';
  if (!['development', 'preview', 'production'].includes(rawEnvironment)) {
    throw new Error(
      'EXPO_PUBLIC_ENV must be development, preview, or production',
    );
  }

  const environment = rawEnvironment as RuntimeEnv['environment'];
  const publicDataApiBaseUrl = input.EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL;
  const mapStyleUrl = input.EXPO_PUBLIC_MAP_STYLE_URL;

  return {
    apiBaseUrl: validatedUrl(
      input.EXPO_PUBLIC_PALTA_API_BASE_URL,
      'EXPO_PUBLIC_PALTA_API_BASE_URL',
      environment,
    ),
    environment,
    ...(publicDataApiBaseUrl
      ? {
          publicDataApiBaseUrl: validatedUrl(
            publicDataApiBaseUrl,
            'EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL',
            environment,
          ),
        }
      : {}),
    ...(mapStyleUrl
      ? {
          mapStyleUrl: validatedUrl(
            mapStyleUrl,
            'EXPO_PUBLIC_MAP_STYLE_URL',
            environment,
          ),
        }
      : {}),
  };
}
