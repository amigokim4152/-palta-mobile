import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { surfaceT } from '../../../../src/localization/index';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function ContextScreen() {
  const { contextId } = useLocalSearchParams<{ contextId: string }>();
  const { locale } = useLocalization();

  return (
    <ScreenFrame
      title={surfaceT('context.title', locale)}
      subtitle={surfaceT('context.subtitle', locale, { id: contextId ?? '' })}
    >
      <Text>{surfaceT('context.body', locale)}</Text>
    </ScreenFrame>
  );
}
