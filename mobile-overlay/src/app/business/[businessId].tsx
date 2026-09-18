import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BusinessProfileExperience } from '../../features/business/BusinessProfileExperience';
import { BusinessRealEstateListingsSection } from '../../features/realEstate/BusinessRealEstateListingsSection';

export default function BusinessProfileRoute() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const canonicalBusinessId = typeof businessId === 'string' ? businessId : '';

  return (
    <View style={{ flex: 1 }}>
      <BusinessProfileExperience />
      {canonicalBusinessId ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
          }}
        >
          <BusinessRealEstateListingsSection businessId={canonicalBusinessId} />
        </View>
      ) : null}
    </View>
  );
}
