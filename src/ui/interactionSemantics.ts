export const MIN_TOUCH_TARGET = 44;

export type MotionPreference = 'standard' | 'reduced';

export type SemanticEmphasis =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'critical';

export function shouldAnimate(
  preference: MotionPreference,
  animationPurpose: 'feedback' | 'orientation' | 'decoration',
): boolean {
  if (preference === 'reduced') {
    return animationPurpose === 'feedback';
  }
  return true;
}

export function clampTouchTarget(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return MIN_TOUCH_TARGET;
  return Math.max(MIN_TOUCH_TARGET, size);
}
