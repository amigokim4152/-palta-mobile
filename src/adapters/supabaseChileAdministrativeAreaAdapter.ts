import type { ServerFetch } from './supabaseLocalBusinessDiscoveryAdapter.js';

export type ChileComunaMatch = Readonly<{
  inputRef: string;
  code: string;
  name: string;
  slug: string;
}>;

export interface ChileAdministrativeAreaRepository {
  resolveComunas(refs: readonly string[]): Promise<readonly ChileComunaMatch[]>;
  resolveComunaCodes(refs: readonly string[]): Promise<readonly string[]>;
}

export type SupabaseChileAdministrativeAreaAdapterOptions = Readonly<{
  projectUrl: string;
  serviceRoleKey: string;
  fetch: ServerFetch;
}>;

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function normalizeRefs(refs: readonly string[]): string[] {
  const clean = refs.map((ref) => ref.trim()).filter(Boolean);
  if (clean.length > 50) throw new Error('comuna_ref_limit_exceeded');
  if (clean.some((ref) => ref.length > 120)) throw new Error('invalid_comuna_ref');
  return [...new Set(clean)];
}

function normalizeMatch(value: unknown): ChileComunaMatch | undefined {
  const row = record(value);
  if (!row) return undefined;
  const inputRef = cleanText(row.input_ref);
  const code = cleanText(row.code);
  const name = cleanText(row.name);
  const slug = cleanText(row.slug);
  if (!inputRef || !code || !name || !slug || !/^\d{5}$/.test(code)) return undefined;
  return { inputRef, code, name, slug };
}

/**
 * Trusted-backend adapter for Chile's shared Country Layer. UI slugs are
 * resolved against one canonical administrative-area registry before any
 * vertical persists territorial codes.
 */
export class SupabaseChileAdministrativeAreaAdapter implements ChileAdministrativeAreaRepository {
  private readonly projectUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: ServerFetch;

  constructor(options: SupabaseChileAdministrativeAreaAdapterOptions) {
    const projectUrl = options.projectUrl.trim().replace(/\/$/, '');
    const serviceRoleKey = options.serviceRoleKey.trim();
    if (!/^https:\/\//.test(projectUrl)) throw new Error('invalid_supabase_project_url');
    if (!serviceRoleKey) throw new Error('missing_supabase_service_role_key');
    this.projectUrl = projectUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = options.fetch;
  }

  async resolveComunas(refs: readonly string[]): Promise<readonly ChileComunaMatch[]> {
    const normalized = normalizeRefs(refs);
    if (normalized.length === 0) return [];

    const response = await this.fetchImpl(
      `${this.projectUrl}/rest/v1/rpc/palta_resolve_cl_comunas`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
        body: JSON.stringify({ p_refs: normalized }),
      },
    );

    if (!response.ok) throw new Error(`palta_resolve_cl_comunas_failed:${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('palta_resolve_cl_comunas_invalid_payload');
    return payload.map(normalizeMatch).filter((item): item is ChileComunaMatch => Boolean(item));
  }

  async resolveComunaCodes(refs: readonly string[]): Promise<readonly string[]> {
    const normalized = normalizeRefs(refs);
    if (normalized.length === 0) return [];
    const matches = await this.resolveComunas(normalized);
    const byRef = new Map(matches.map((match) => [match.inputRef.toLowerCase(), match]));

    return normalized.map((ref) => {
      const match = byRef.get(ref.toLowerCase());
      if (!match) throw new Error(`unresolved_comuna_ref:${ref}`);
      return match.code;
    });
  }
}
