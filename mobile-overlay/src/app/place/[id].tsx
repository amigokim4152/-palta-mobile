import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, Text } from 'react-native';
import { surfaceT } from '../../../../src/localization/index';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useLocalization();

  return (
    <SafeAreaView>
      <Text>
        {surfaceT('place.id', locale, { id: id ?? '' })}
      </Text>
    </SafeAreaView>
  );
}
