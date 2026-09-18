import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  discoveryT,
  type DiscoveryKey,
} from '../../../../src/localization/index';
import {
  marketVerticalByKey,
  type MarketVerticalKey,
} from '../../../../src/market/marketVerticalPolicy';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useLocalization } from '../../providers/LocalizationProvider';

const verticalTitleKeys: Record<MarketVerticalKey, DiscoveryKey> = {
  secondhand: 'market.vertical.secondhand',
  vehicles: 'market.vertical.vehicles',
  property: 'market.vertical.property',
  jobs_services: 'market.vertical.jobs_services',
};

export default function MarketVerticalScreen() {
  const { vertical, mode } = useLocalSearchParams<{
    vertical: MarketVerticalKey;
    mode?: string;
  }>();
  const { locale } = useLocalization();

  let definition;
  try {
    definition = marketVerticalByKey(vertical);
  } catch {
    return (
      <ScreenFrame title={discoveryT('market.title', locale)}>
        <Text>{discoveryT('market.invalidCategory', locale)}</Text>
      </ScreenFrame>
    );
  }

  const createMode = mode === 'create';
  const category = discoveryT(verticalTitleKeys[definition.key], locale);

  return (
    <ScreenFrame
      title={category}
      subtitle={discoveryT(
        createMode ? 'common.publish' : 'common.explore',
        locale,
      )}
    >
      <View style={{ gap: 16 }}>
        <SectionHeading
          title={discoveryT(
            createMode ? 'market.publishIn' : 'market.exploreCategory',
            locale,
            { category },
          )}
          subtitle={
            createMode
              ? discoveryT('market.createSubtitle', locale)
              : definition.mapUseful
                ? discoveryT('market.mapSubtitle', locale)
                : discoveryT('market.listSubtitle', locale)
          }
        />
        <Text style={{ opacity: 0.62 }}>
          {discoveryT('market.contractPending', locale)}
        </Text>
      </View>
    </ScreenFrame>
  );
}
