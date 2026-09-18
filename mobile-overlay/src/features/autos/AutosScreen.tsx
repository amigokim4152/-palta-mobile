import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { paltaTheme } from '../../theme/paltaTheme';

function AutosAction({
  title,
  body,
  onPress,
}: {
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 92,
        justifyContent: 'center',
        gap: paltaTheme.spacing.xxs,
        paddingHorizontal: paltaTheme.spacing.md,
        paddingVertical: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
      })}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: paltaTheme.color.textPrimary,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: paltaTheme.color.textSecondary,
        }}
      >
        {body}
      </Text>
    </Pressable>
  );
}

export function AutosScreen() {
  return (
    <ScreenFrame
      title="Autos"
      subtitle="Compra y vende vehículos cerca de ti"
    >
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <SectionHeading
          title="¿Qué quieres hacer?"
          subtitle="Encuentra vehículos o inicia una publicación desde un flujo específico para autos."
        />

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <AutosAction
            title="Comprar un auto"
            body="Explora vehículos publicados y filtra por zona, precio y características."
            onPress={() => router.push('/market/vehicles')}
          />
          <AutosAction
            title="Vender mi auto"
            body="Inicia una publicación específica para vehículos."
            onPress={() => router.push('/market/vehicles?mode=create')}
          />
        </View>
      </View>
    </ScreenFrame>
  );
}
