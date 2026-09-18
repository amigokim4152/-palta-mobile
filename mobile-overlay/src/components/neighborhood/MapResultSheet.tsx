import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  nextSheetSnap,
  type ResultSheetSnap,
} from '../../../../src/neighborhood/resultSheetPolicy';
import { paltaTheme } from '../../theme/paltaTheme';

const heightBySnap: Record<ResultSheetSnap, number> = {
  peek: 170,
  half: 340,
  full: 620,
};

export function MapResultSheet({
  snap,
  onSnapChange,
  children,
}: PropsWithChildren<{
  snap: ResultSheetSnap;
  onSnapChange: (next: ResultSheetSnap) => void;
}>) {
  const expanding = snap !== 'full';
  const direction = expanding ? 'up' : 'down';
  const actionLabel = expanding ? 'Más resultados' : 'Más mapa';

  return (
    <View
      accessibilityLabel="Resultados del mapa"
      style={{
        minHeight: heightBySnap[snap],
        maxHeight: heightBySnap[snap],
        borderTopWidth: 1,
        borderTopColor: paltaTheme.color.divider,
        borderTopLeftRadius: paltaTheme.radius.sheet,
        borderTopRightRadius: paltaTheme.radius.sheet,
        paddingHorizontal: paltaTheme.spacing.md,
        paddingBottom: paltaTheme.spacing.sm,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 6,
        }}
      >
        <View
          style={{
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: paltaTheme.color.border,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => onSnapChange(nextSheetSnap(snap, direction))}
          style={{
            minHeight: 40,
            justifyContent: 'center',
            paddingHorizontal: 14,
          }}
        >
          <Text
            style={{
              color: paltaTheme.color.textSecondary,
              fontSize: 13,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
