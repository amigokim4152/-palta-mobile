import type { CoreProfile, LifeAreaRef } from './profileModel.js';
import {
  initialOnboardingPrompts,
  type ProfilePrompt,
} from './progressiveProfile.js';

export type InitialOnboardingState = {
  canEnterHome: true;
  complete: boolean;
  prompts: readonly ProfilePrompt[];
  completedFields: readonly ('preferred_name' | 'home_commune')[];
};

export function initialOnboardingState(input: {
  profile: CoreProfile;
  lifeAreas: readonly LifeAreaRef[];
}): InitialOnboardingState {
  const completedFields: ('preferred_name' | 'home_commune')[] = [];
  if (input.profile.preferredName?.trim()) completedFields.push('preferred_name');
  if (
    input.lifeAreas.some(
      (area) => area.kind === 'home' && Boolean(area.communeCode),
    )
  ) {
    completedFields.push('home_commune');
  }

  const pending = initialOnboardingPrompts().filter(
    (prompt) => !completedFields.includes(prompt.field as 'preferred_name' | 'home_commune'),
  );

  return {
    canEnterHome: true,
    complete: pending.length === 0,
    prompts: pending,
    completedFields,
  };
}
