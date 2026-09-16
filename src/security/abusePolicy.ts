export type AbuseSignal = {
  repeatedFailedAuth: number;
  rapidOrderAttempts: number;
  refundBurst: number;
  qrReuseAcrossDistantLocations: number;
  repeatedExportAttempts: number;
};

export type AbuseDecision =
  | 'allow'
  | 'challenge'
  | 'throttle'
  | 'block_and_review';

export function assessAbuse(signal: AbuseSignal): AbuseDecision {
  if (
    signal.repeatedFailedAuth >= 20 ||
    signal.refundBurst >= 10 ||
    signal.qrReuseAcrossDistantLocations >= 5 ||
    signal.repeatedExportAttempts >= 10
  ) {
    return 'block_and_review';
  }

  if (
    signal.repeatedFailedAuth >= 8 ||
    signal.rapidOrderAttempts >= 20 ||
    signal.refundBurst >= 5
  ) {
    return 'throttle';
  }

  if (
    signal.repeatedFailedAuth >= 4 ||
    signal.rapidOrderAttempts >= 10 ||
    signal.qrReuseAcrossDistantLocations >= 2
  ) {
    return 'challenge';
  }

  return 'allow';
}
