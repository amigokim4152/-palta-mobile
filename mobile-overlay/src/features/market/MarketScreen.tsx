import { router } from 'expo-router';
import { View } from 'react-native';
import {
  discoveryT,
  type DiscoveryKey,
} from '../../../../src/localization/index';
import {
  marketVerticals,
  type MarketVerticalKey,
} from '../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';
import { useLocalization } from '../../providers/LocalizationProvider';

const verticalTitleKeys: Record<MarketVerticalKey, DiscoveryKey> = {
  secondhand: 'market.vertical.secondhand',
  vehicles: 'market.vertical.vehicles',
  property: 'market.vertical.property',
  jobs_services: 'market.vertical.jobs_services',
};

export function MarketScreen() {
  const { locale } = useLocalization();
  const text = (key: DiscoveryKey) => discoveryT(key, locale);

  return (
    <ScreenFrame
      title={text('market.title')}
      subtitle={text('market.subtitle')}
    >
      <View style={{ gap: 20 }}>
        {marketVerticals.map((vertical) => (
          <View key={vertical.key} style={{ gap: 10 }}>
            <SectionHeading
              title={text(verticalTitleKeys[vertical.key])}
              subtitle={
                vertical.mapUseful
                  ? text('market.mapUseful')
                  : text('market.listOnly')
              }
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PaltaButton
                label={text('common.explore')}
                variant="primary"
                onPress={() =>
                  router.push(`/market/${vertical.key}`)
                }
              />
              <PaltaButton
                label={text('common.publish')}
                variant="secondary"
                onPress={() =>
                  router.push(
                    `/market/${vertical.key}?mode=create`,
                  )
                }
              />
            </View>
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
