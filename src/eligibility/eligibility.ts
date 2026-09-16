export type EligibilityState =
  | 'confirmed_eligible'
  | 'likely'
  | 'possible'
  | 'unknown'
  | 'not_eligible'
  | 'changed_or_recheck';

export interface EligibilityDecision {
  state: EligibilityState;
  ruleSignature: string;
  policyVersion: string;
  exclusionReason?: string;
  evaluatedAt: string;
}

export interface SuppressionRecord {
  ruleSignature: string;
  policyVersion: string;
  userConditionSignature: string;
  suppressedAt: string;
}

export function shouldSuppress(
  decision: EligibilityDecision,
  previous: SuppressionRecord | undefined,
  currentUserConditionSignature: string,
): boolean {
  if (decision.state !== 'not_eligible' || !previous) return false;
  return (
    previous.ruleSignature === decision.ruleSignature &&
    previous.policyVersion === decision.policyVersion &&
    previous.userConditionSignature === currentUserConditionSignature
  );
}

export function shouldRecheck(
  previous: SuppressionRecord,
  nextRuleSignature: string,
  nextPolicyVersion: string,
  currentUserConditionSignature: string,
): boolean {
  return (
    previous.ruleSignature !== nextRuleSignature ||
    previous.policyVersion !== nextPolicyVersion ||
    previous.userConditionSignature !== currentUserConditionSignature
  );
}
