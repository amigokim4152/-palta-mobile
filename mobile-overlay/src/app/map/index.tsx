import { Text } from 'react-native';
import { surfaceT } from '../../../../src/localization/index';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function SharedMapScreen() {
  const { locale } = useLocalization();

  return (
    <ScreenFrame
      title={surfaceT('map.title', locale)}
      subtitle={surfaceT('map.subtitle', locale)}
      scroll={false}
    >
      <Text>{surfaceT('map.body', locale)}</Text>
    </ScreenFrame>
  );
}
