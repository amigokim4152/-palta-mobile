import {
  decidePresentation,
  type PresentationSignal,
} from './presentationPriority.js';
import {
  focusLayoutPolicy,
  type FocusLayoutPolicy,
} from '../accessibility/focusLayout.js';

export type ExperienceDecision = {
  presentation: ReturnType<typeof decidePresentation>;
  layout: FocusLayoutPolicy;
  showSummaryBeforeDetail: boolean;
  showExplicitMoreLabel: boolean;
};

export function decideExperience(input: {
  signal: PresentationSignal;
  fontScale: number;
  isInteractionDense?: boolean;
}): ExperienceDecision {
  const presentation = decidePresentation(input.signal);
  const layout = focusLayoutPolicy(input.fontScale);

  const accessibilityHeavy =
    layout.preferTextLabelsOverIconOnly ||
    layout.maxInitialSecondaryItems <= 1;

  return {
    presentation,
    layout,
    showSummaryBeforeDetail:
      presentation.tier !== 'focus' && accessibilityHeavy,
    showExplicitMoreLabel:
      accessibilityHeavy || Boolean(input.isInteractionDense),
  };
}
