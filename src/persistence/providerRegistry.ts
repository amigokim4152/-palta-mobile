export type ProviderRole =
  | 'auth'
  | 'database'
  | 'object_storage'
  | 'edge'
  | 'notifications'
  | 'maps'
  | 'analytics';

export type ProviderBinding = {
  role: ProviderRole;
  provider: string;
  status: 'primary' | 'secondary' | 'candidate' | 'disabled';
  replaceable: true;
};

export class ProviderRegistry {
  private readonly bindings = new Map<ProviderRole, ProviderBinding>();

  bind(binding: ProviderBinding): void {
    this.bindings.set(binding.role, binding);
  }

  get(role: ProviderRole): ProviderBinding | null {
    return this.bindings.get(role) ?? null;
  }

  all(): ProviderBinding[] {
    return [...this.bindings.values()];
  }
}
