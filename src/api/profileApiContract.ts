export type ProfileApiResponse = {
  preferred_name?: string;
  preferred_language: string;
  timezone: string;
  country_code?: string;
};

export type UpdateProfileApiInput = {
  /** null explicitly clears the optional preferred name. */
  preferred_name?: string | null;
};

export function normalizePreferredName(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
}
