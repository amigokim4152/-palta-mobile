import { View } from 'react-native';
import { BusinessDiscoveryExperience } from '../../features/business/BusinessDiscoveryExperience';
import { BusinessVerticalHandoffBar } from '../../features/business/BusinessVerticalHandoffBar';

/**
 * Primary Local Business surface.
 *
 * Negocios exposes independent Palta verticals as handoffs rather than
 * absorbing their domain state. Propiedades is the first explicit example.
 */
export default function BusinessesTab() {
  return (
    <View style={{ flex: 1 }}>
      <BusinessVerticalHandoffBar />
      <View style={{ flex: 1 }}>
        <BusinessDiscoveryExperience />
      </View>
    </View>
  );
}
