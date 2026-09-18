import { Pressable, Text, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

export type GlanceItem = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  exceptional?: boolean;
  onPress?: () => void;
};

export function GlanceCluster({
  items,
  columns,
  maxItems,
  onMore,
}: {
  items: readonly GlanceItem[];
  columns: 1 | 2;
  maxItems: number;
  onMore?: () => void;
}) {
  const visible = items.slice(0, maxItems);
  const hiddenCount = Math.max(0, items.length - visible.length);

  return (
    <View
      accessibilityLabel="Información rápida"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: paltaTheme.color.divider,
      }}
    >
      {visible.map((item, index) => {
        const basis = columns === 2 ? '50%' : '100%';
        const isLeftColumn = columns === 2 && index % 2 === 0;
        return (
          <Pressable
            key={item.id}
            accessibilityRole={item.onPress ? 'button' : undefined}
            onPress={item.onPress}
            disabled={!item.onPress}
            style={{
              width: basis,
              minHeight: 50,
              paddingVertical: 7,
              paddingLeft: isLeftColumn ? 0 : 12,
              paddingRight: isLeftColumn ? 12 : 0,
              borderRightWidth: isLeftColumn ? 1 : 0,
              borderBottomWidth:
                index < visible.length - (columns === 2 ? 2 : 1) ? 1 : 0,
              borderColor: paltaTheme.color.divider,
              justifyContent: 'center',
            }}
          >
            <Text
              allowFontScaling
              style={{
                fontSize: 11,
                lineHeight: 15,
                color: paltaTheme.color.textSecondary,
                fontWeight: '700',
              }}
            >
              {item.label}
            </Text>
            <View
              style={{
                marginTop: 1,
                flexDirection: columns === 2 ? 'row' : 'column',
                alignItems: columns === 2 ? 'baseline' : 'flex-start',
                gap: 4,
              }}
            >
              <Text
                allowFontScaling
                style={{
                  fontSize: 17,
                  lineHeight: 22,
                  fontWeight: '700',
                  color: item.exceptional
                    ? paltaTheme.color.warning
                    : paltaTheme.color.textPrimary,
                }}
              >
                {item.value}
              </Text>
              {item.detail ? (
                <Text
                  allowFontScaling
                  style={{
                    fontSize: 12,
                    lineHeight: 17,
                    color: paltaTheme.color.textSecondary,
                  }}
                >
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      {hiddenCount > 0 && onMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={onMore}
          style={{
            minHeight: paltaTheme.touch.minimum,
            width: '100%',
            justifyContent: 'center',
            paddingVertical: 8,
          }}
        >
          <Text
            allowFontScaling
            style={{
              color: paltaTheme.color.brandPrimary,
              fontWeight: '700',
            }}
          >
            Ver {hiddenCount} más
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
