import * as paltaClient from '../../services/paltaClient';
import type { MobileRuntime } from '../../services/paltaClient';

type ComposedPaltaClientModule = typeof paltaClient & {
  getAuthenticatedMobileRuntime?: () => MobileRuntime;
};

/**
 * Local Business does not own Auth. The runtime composition supplies the
 * canonical getAuthenticatedMobileRuntime() backed by the shared Supabase
 * AuthPort. Keeping this lookup local lets the feature branch typecheck on its
 * own without copying Auth adapters or auth-provider dependencies into
 * Negocios.
 */
export function getBusinessAuthenticatedRuntime(): MobileRuntime {
  const factory = (paltaClient as ComposedPaltaClientModule)
    .getAuthenticatedMobileRuntime;

  if (!factory) {
    return {
      status: 'config_error',
      message: 'Inicia sesión para continuar con esta acción.',
    };
  }

  return factory();
}
