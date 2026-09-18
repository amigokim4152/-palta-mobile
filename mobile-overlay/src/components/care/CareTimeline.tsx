import { Text, View } from 'react-native';
import {
  careT,
  type CareCopyKey,
} from '../../../../src/localization/index';
import {
  buildCareTimeline,
  careStateLabel,
  type CareState,
} from '../../../../src/care/careTimeline';
import { useLocalization } from '../../providers/LocalizationProvider';

const statusKeys: Record<'done' | 'current' | 'upcoming', CareCopyKey> = {
  done: 'care.timeline.done',
  current: 'care.timeline.current',
  upcoming: 'care.timeline.upcoming',
};

export function CareTimeline({
  state,
}: {
  state: CareState;
}) {
  const { locale } = useLocalization();
  const steps = buildCareTimeline(state);

  if (state === 'cancelled') {
    return <Text allowFontScaling>{careStateLabel(state, locale)}</Text>;
  }

  return (
    <View accessibilityRole="list" style={{ gap: 10 }}>
      {steps.map((step) => (
        <View
          key={step.state}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: step.status === 'upcoming' ? 0.42 : 1,
          }}
        >
          <Text
            accessibilityLabel={careT(statusKeys[step.status], locale)}
            style={{ width: 22, textAlign: 'center' }}
          >
            {step.status === 'done'
              ? '✓'
              : step.status === 'current'
                ? '●'
                : '○'}
          </Text>
          <Text
            allowFontScaling
            style={{
              fontWeight:
                step.status === 'current' ? '700' : '500',
            }}
          >
            {careStateLabel(step.state, locale)}
          </Text>
        </View>
      ))}
    </View>
  );
}
