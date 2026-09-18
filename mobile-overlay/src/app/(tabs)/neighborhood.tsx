import { View } from 'react-native';
import { BusinessDiscoveryExperience } from '../../features/business/BusinessDiscoveryExperience';
import { BusinessVerticalHandoffBar } from '../../features/business/BusinessVerticalHandoffBar';

/**
 * Legacy Barrio/neighborhood route kept for older links/runtime state.
 * It must render the same canonical Negocios surface as the primary route so
 * independent verticals such as Autos and Propiedades remain discoverable.
 */
export default function NeighborhoodCompatibilityTab() {
  return (
    <View style={{ flex: 1 }}>
      <BusinessVerticalHandoffBar />
      <View style={{ flex: 1 }}>
        <BusinessDiscoveryExperience />
      </View>
    </View>
  );
}
