import { Pressable, Text } from 'react-native';
import { ui } from '../../theme/semanticUi';

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={{
        minHeight: ui.touch.minimum,
        paddingHorizontal: 14,
        borderRadius: ui.radius.pill,
        borderWidth: 1,
        justifyContent: 'center',
      }}
    >
      <Text allowFontScaling style={{ fontWeight: selected ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}
