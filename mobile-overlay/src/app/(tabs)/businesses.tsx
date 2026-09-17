import { LocalBusinessDiscoveryScreen } from '../../features/business/LocalBusinessDiscoveryScreen';

/**
 * Primary Local Business surface.
 *
 * This is intentionally a thin route wrapper: the same canonical discovery
 * experience is reused by legacy/deep-link routes instead of creating a
 * second Local Business implementation.
 */
export default LocalBusinessDiscoveryScreen;
