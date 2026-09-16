import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export function ReadingToolbar({
  listening,
  onToggleListen,
  onIncreaseText,
  onDecreaseText,
  focusMode,
  onToggleFocus,
}: {
  listening: boolean;
  onToggleListen: () => void;
  onIncreaseText: () => void;
  onDecreaseText: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  const control = (
    label: string,
    onPress: () => void,
    selected = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: paltaTheme.touch.minimum,
        minWidth: paltaTheme.touch.minimum,
        paddingHorizontal: 10,
        justifyContent: 'center',
        borderRadius: paltaTheme.radius.control,
        borderWidth: 1,
        borderColor: selected
          ? paltaTheme.color.brandPrimary
          : paltaTheme.color.border,
        backgroundColor: selected
          ? paltaTheme.color.brandSoft
          : paltaTheme.color.surface,
      }}
    >
      <Text allowFontScaling style={{ fontWeight: '750' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {control(listening ? '일시정지' : '이 글 듣기', onToggleListen, listening)}
      {control('A−', onDecreaseText)}
      {control('A+', onIncreaseText)}
      {control('집중해서 읽기', onToggleFocus, focusMode)}
    </View>
  );
}
