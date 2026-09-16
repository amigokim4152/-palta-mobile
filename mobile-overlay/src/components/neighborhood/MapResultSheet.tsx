import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  nextSheetSnap,
  type ResultSheetSnap,
} from '../../../../src/neighborhood/resultSheetPolicy';

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
  return (
    <View
      accessibilityLabel="Resultados del mapa"
      style={{
        minHeight: heightBySnap[snap],
        maxHeight: heightBySnap[snap],
        borderTopWidth: 1,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 12,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrar más resultados"
          onPress={() => onSnapChange(nextSheetSnap(snap, 'up'))}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ textAlign: 'center' }}>↑</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrar más mapa"
          onPress={() => onSnapChange(nextSheetSnap(snap, 'down'))}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ textAlign: 'center' }}>↓</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
