import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  useWindowDimensions,
} from 'react-native';
import {
  focusLayoutPolicy,
  type TextScaleClass,
} from '../../../src/accessibility/focusLayout';

export type AdaptiveExperience = {
  fontScale: number;
  textScaleClass: TextScaleClass;
  reduceMotion: boolean;
  screenReaderEnabled: boolean;
  isNarrow: boolean;
  layout: ReturnType<typeof focusLayoutPolicy>;
};

export function useAdaptiveExperience(
  simulatedFontScale?: number,
): AdaptiveExperience {
  const dimensions = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  const systemFontScale = PixelRatio.getFontScale();
  const fontScale = simulatedFontScale ?? systemFontScale;

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (active) setScreenReaderEnabled(enabled);
    });

    const reduceSub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const readerSub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled,
    );

    return () => {
      active = false;
      reduceSub.remove();
      readerSub.remove();
    };
  }, []);

  return useMemo(() => {
    const layout = focusLayoutPolicy(fontScale);
    const textScaleClass =
      fontScale <= 1.15
        ? 'normal'
        : fontScale <= 1.55
          ? 'large'
          : 'accessibility';

    return {
      fontScale,
      textScaleClass,
      reduceMotion,
      screenReaderEnabled,
      isNarrow: dimensions.width < 390,
      layout,
    };
  }, [
    dimensions.width,
    fontScale,
    reduceMotion,
    screenReaderEnabled,
  ]);
}
