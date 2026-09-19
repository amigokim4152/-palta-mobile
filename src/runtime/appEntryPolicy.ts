export type AppEntryPolicy = 'app' | 'auth';

export function resolveAppEntryPolicy(options: {
  environment: string | undefined;
  preview: string | undefined;
  entryMode: string | undefined;
  developmentBuild: boolean;
}): AppEntryPolicy {
  if (options.environment === 'production') return 'auth';
  const development = options.developmentBuild;
  const preview = options.environment === 'preview' && options.preview === '1';
  if (!development && !preview) return 'auth';
  return options.entryMode === 'auth_qa' ? 'auth' : 'app';
}
