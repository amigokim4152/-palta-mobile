import { Text } from 'react-native';
import { surfaceT } from '../../../../src/localization/index';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function SearchScreen() {
  const { locale } = useLocalization();

  return (
    <ScreenFrame
      title={surfaceT('search.title', locale)}
      subtitle={surfaceT('search.subtitle', locale)}
    >
      <Text>{surfaceT('search.scope', locale)}</Text>
    </ScreenFrame>
  );
}
