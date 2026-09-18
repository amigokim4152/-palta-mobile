import { View } from 'react-native';
import type { UiKey } from '../../../../src/localization/index';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useLocalization } from '../../providers/LocalizationProvider';

const sections: Array<{
  titleKey: UiKey;
  subtitleKey: UiKey;
}> = [
  {
    titleKey: 'community.myGroupsTitle',
    subtitleKey: 'community.myGroupsSubtitle',
  },
  {
    titleKey: 'community.neighborhoodTitle',
    subtitleKey: 'community.neighborhoodSubtitle',
  },
  {
    titleKey: 'community.discoverTitle',
    subtitleKey: 'community.discoverSubtitle',
  },
];

export function CommunityScreen() {
  const { t } = useLocalization();

  return (
    <ScreenFrame
      title={t('community.title')}
      subtitle={t('community.subtitle')}
    >
      <View style={{ gap: 24 }}>
        {sections.map((section) => (
          <View key={section.titleKey} style={{ gap: 10 }}>
            <SectionHeading
              title={t(section.titleKey)}
              subtitle={t(section.subtitleKey)}
            />
            <PaltaButton
              label={t('common.view')}
              variant="secondary"
              onPress={() => {}}
            />
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
