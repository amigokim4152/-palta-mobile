import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  nextSheetSnap,
  type ResultSheetSnap,
} from '../../../../src/neighborhood/resultSheetPolicy';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function MapResultSheet({
  snap,
  onSnapChange,
  children,
}: PropsWithChildren<{
  snap: ResultSheetSnap;
  onSnapChange: (next: ResultSheetSnap) => void;
}>) {
  const { height: windowHeight } = useWindowDimensions();
  const heights = useMemo<Record<ResultSheetSnap, number>>(
    () => ({
      peek: clamp(windowHeight * 0.20, 150, 190),
      half: clamp(windowHeight * 0.34, 240, 330),
      full: clamp(windowHeight * 0.48, 330, 520),
    }),
    [windowHeight],
  );
  const animatedHeight = useRef(new Animated.Value(heights[snap])).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: heights[snap],
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [animatedHeight, heights, snap]);

  return (
    <Animated.View
      accessibilityLabel="Resultados del mapa"
      style={{
        height: animatedHeight,
        borderTopWidth: 1,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 12,
        paddingTop: 6,
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
          disabled={snap === 'full'}
          onPress={() => onSnapChange(nextSheetSnap(snap, 'up'))}
          style={{
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
            opacity: snap === 'full' ? 0.3 : 1,
          }}
        >
          <Text style={{ textAlign: 'center' }}>↑</Text>
        </Pressable>
        <View
          accessibilityElementsHidden
          style={{ width: 42, height: 4, borderRadius: 999, backgroundColor: '#9ca3af' }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrar más mapa"
          disabled={snap === 'peek'}
          onPress={() => onSnapChange(nextSheetSnap(snap, 'down'))}
          style={{
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
            opacity: snap === 'peek' ? 0.3 : 1,
          }}
        >
          <Text style={{ textAlign: 'center' }}>↓</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 18 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}
