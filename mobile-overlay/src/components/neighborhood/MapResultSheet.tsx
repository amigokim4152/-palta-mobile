import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  nextSheetSnap,
  type ResultSheetSnap,
} from '../../../../src/neighborhood/resultSheetPolicy';
import { paltaTheme } from '../../theme/paltaTheme';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nearestSnap(
  height: number,
  heights: Record<ResultSheetSnap, number>,
): ResultSheetSnap {
  const snaps: ResultSheetSnap[] = ['peek', 'half', 'full'];
  return snaps.reduce((best, candidate) =>
    Math.abs(heights[candidate] - height) < Math.abs(heights[best] - height)
      ? candidate
      : best,
  'peek');
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
      half: clamp(windowHeight * 0.38, 260, 350),
      full: clamp(windowHeight * 0.62, 390, 580),
    }),
    [windowHeight],
  );
  const animatedHeight = useRef(new Animated.Value(heights[snap])).current;
  const gestureStartHeight = useRef(heights[snap]);
  const latestDragHeight = useRef(heights[snap]);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: heights[snap],
      duration: 180,
      useNativeDriver: false,
    }).start();
    latestDragHeight.current = heights[snap];
  }, [animatedHeight, heights, snap]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          animatedHeight.stopAnimation();
          gestureStartHeight.current = heights[snap];
          latestDragHeight.current = heights[snap];
        },
        onPanResponderMove: (_, gestureState) => {
          const next = clamp(
            gestureStartHeight.current - gestureState.dy,
            heights.peek,
            heights.full,
          );
          latestDragHeight.current = next;
          animatedHeight.setValue(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.vy < -0.35) {
            onSnapChange(nextSheetSnap(snap, 'up'));
            return;
          }
          if (gestureState.vy > 0.35) {
            onSnapChange(nextSheetSnap(snap, 'down'));
            return;
          }
          onSnapChange(nearestSnap(latestDragHeight.current, heights));
        },
        onPanResponderTerminate: () => {
          Animated.timing(animatedHeight, {
            toValue: heights[snap],
            duration: 160,
            useNativeDriver: false,
          }).start();
        },
      }),
    [animatedHeight, heights, onSnapChange, snap],
  );

  const toggleSnap = () => {
    onSnapChange(snap === 'full' ? nextSheetSnap(snap, 'down') : nextSheetSnap(snap, 'up'));
  };

  return (
    <Animated.View
      accessibilityLabel="Resultados del mapa"
      style={{
        height: animatedHeight,
        borderTopWidth: 1,
        borderColor: paltaTheme.color.border,
        borderTopLeftRadius: paltaTheme.radius.sheet,
        borderTopRightRadius: paltaTheme.radius.sheet,
        paddingHorizontal: paltaTheme.spacing.sm,
        paddingTop: paltaTheme.spacing.xxs,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      <Pressable
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={
          snap === 'full'
            ? 'Mostrar más mapa'
            : 'Mostrar más resultados'
        }
        onPress={toggleSnap}
        hitSlop={8}
        style={{
          minHeight: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          accessibilityElementsHidden
          style={{
            width: 44,
            height: 5,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.border,
          }}
        />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: paltaTheme.spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}
