import { View } from 'react-native';
import {
  discoveryT,
  type DiscoveryKey,
} from '../../../../src/localization/index';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useLocalization } from '../../providers/LocalizationProvider';

const sections: Array<{
  key: string;
  titleKey: DiscoveryKey;
  subtitleKey: DiscoveryKey;
}> = [
  {
    key: 'eat_drink',
    titleKey: 'play.eatDrinkTitle',
    subtitleKey: 'play.eatDrinkSubtitle',
  },
  {
    key: 'events_culture',
    titleKey: 'play.eventsCultureTitle',
    subtitleKey: 'play.eventsCultureSubtitle',
  },
  {
    key: 'family',
    titleKey: 'play.familyTitle',
    subtitleKey: 'play.familySubtitle',
  },
  {
    key: 'travel_stays',
    titleKey: 'play.travelStaysTitle',
    subtitleKey: 'play.travelStaysSubtitle',
  },
];

export function PlayScreen() {
  const { locale } = useLocalization();

  return (
    <ScreenFrame
      title={discoveryT('play.title', locale)}
      subtitle={discoveryT('play.subtitle', locale)}
    >
      <View style={{ gap: 22 }}>
        {sections.map((section) => (
          <View key={section.key} style={{ gap: 10 }}>
            <SectionHeading
              title={discoveryT(section.titleKey, locale)}
              subtitle={discoveryT(section.subtitleKey, locale)}
            />
            <PaltaButton
              label={discoveryT('common.explore', locale)}
              variant="secondary"
              onPress={() => {}}
            />
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
