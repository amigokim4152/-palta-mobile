import { Text, View } from 'react-native';
import {
  buildCareTimeline,
  careStateLabel,
  type CareState,
} from '../../../../src/care/careTimeline';

export function CareTimeline({ state }: { state: CareState }) {
  const steps = buildCareTimeline(state);

  if (state === 'cancelled') {
    return <Text allowFontScaling>Cancelado</Text>;
  }

  return (
    <View accessibilityRole="list" style={{ gap: 10 }}>
      {steps.map((step) => (
        <View
          key={step.state}
          accessible
          accessibilityLabel={`${careStateLabel(step.state)} · ${step.status}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            opacity: step.status === 'upcoming' ? 0.42 : 1,
          }}
        >
          <Text style={{ width: 22, textAlign: 'center' }}>
            {step.status === 'done' ? '✓' : step.status === 'current' ? '●' : '○'}
          </Text>
          <Text
            allowFontScaling
            style={{ fontWeight: step.status === 'current' ? '700' : '500' }}
          >
            {careStateLabel(step.state)}
          </Text>
        </View>
      ))}
    </View>
  );
}
