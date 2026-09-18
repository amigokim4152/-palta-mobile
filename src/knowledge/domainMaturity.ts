import type { DomainMaturity, KnowledgeDomainProfile } from './contracts.js';

export interface GraduationSignals {
  hasIndependentQuestionSpace: boolean;
  hasDeepContent: boolean;
  hasConnectedKnowledgeGraph: boolean;
  hasDistinctNavigationNeed: boolean;
  hasIndependentSearchValue: boolean;
  hasLocalizationValue: boolean;
  hasSustainableReviewFlow: boolean;
}

export interface GraduationAssessment {
  current: DomainMaturity;
  candidate: DomainMaturity;
  missingSignals: (keyof GraduationSignals)[];
  requiresHumanDecision: true;
}

export function assessDomainGraduation(
  profile: KnowledgeDomainProfile,
  signals: GraduationSignals,
): GraduationAssessment {
  const missingSignals = (Object.entries(signals) as [keyof GraduationSignals, boolean][]) 
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const allReady = missingSignals.length === 0;
  let candidate = profile.maturity;

  if (profile.maturity === 'seed' && (signals.hasDeepContent || signals.hasConnectedKnowledgeGraph)) {
    candidate = 'growing';
  } else if (profile.maturity === 'growing' && allReady) {
    candidate = 'mature';
  } else if (profile.maturity === 'mature' && allReady) {
    candidate = 'standalone';
  }

  return { current: profile.maturity, candidate, missingSignals, requiresHumanDecision: true };
}
