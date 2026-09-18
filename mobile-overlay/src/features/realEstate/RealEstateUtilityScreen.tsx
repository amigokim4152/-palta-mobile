import { router } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';

export function RealEstateUtilityScreen({
  title,
  body,
  primaryLabel,
  onPrimaryPress,
}: {
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <View style={{ flex: 1, padding: paltaTheme.spacing.lg, justifyContent: 'center', gap: paltaTheme.spacing.md }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: paltaTheme.color.textSecondary }}>{body}</Text>
        {primaryLabel ? <PaltaButton label={primaryLabel} onPress={onPrimaryPress} /> : null}
        <PaltaButton label="Volver a Propiedades" variant="secondary" onPress={() => router.replace('/propiedades')} />
      </View>
    </SafeAreaView>
  );
}
