import { useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import {
  Animated,
  PanResponder,
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
import { paltaTheme } from '../../theme/paltaTheme';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nearestSnap(
  height: number,
  heights: Record<ResultSheetSnap, number>,
): ResultSheetSnap {
  const snaps: ResultSheetSnap[] = ['peek', 'half', 'full'];
  return snaps.reduce(
    (best, candidate) =>
      Math.abs(heights[candidate] - height) <
      Math.abs(heights[best] - height)
        ? candidate
        : best,
    'peek',
  );
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
      peek: clamp(windowHeight * 0.2, 150, 190),
      half: clamp(windowHeight * 0.34, 240, 330),
      full: clamp(windowHeight * 0.48, 330, 520),
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

  const expanding = snap !== 'full';
  const actionDirection = expanding ? 'up' : 'down';
  const actionLabel = expanding ? 'Más resultados' : 'Más mapa';

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
      <View
        {...panResponder.panHandlers}
        accessibilityLabel="Arrastra para mostrar más resultados o más mapa"
        style={{
          minHeight: paltaTheme.touch.minimum,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => onSnapChange(nextSheetSnap(snap, actionDirection))}
          style={{
            minHeight: 30,
            justifyContent: 'center',
            paddingHorizontal: 14,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              color: paltaTheme.color.textSecondary,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      </View>

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
