import type { DataClass } from '../privacy/dataClassification.js';

export type ProgressiveProfileField =
  | 'preferred_name'
  | 'home_commune'
  | 'phone'
  | 'rut'
  | 'precise_address'
  | 'school_relationship'
  | 'vehicle'
  | 'pet'
  | 'health_detail';

export type ProfilePrompt = {
  field: ProgressiveProfileField;
  purpose: string;
  userBenefit: string;
  surface: string;
  dataClass: DataClass;
  blocking: boolean;
  canSkip: boolean;
};

export type ProfilePromptValidation =
  | { allowed: true }
  | { allowed: false; reason: string };

const fieldClass: Record<ProgressiveProfileField, DataClass> = {
  preferred_name: 'personal',
  home_commune: 'personal',
  phone: 'personal',
  rut: 'sensitive_personal',
  precise_address: 'sensitive_personal',
  school_relationship: 'sensitive_personal',
  vehicle: 'personal',
  pet: 'personal',
  health_detail: 'sensitive_personal',
};

export function dataClassForProfileField(
  field: ProgressiveProfileField,
): DataClass {
  return fieldClass[field];
}

export function validateProfilePrompt(
  prompt: ProfilePrompt,
): ProfilePromptValidation {
  if (prompt.purpose.trim().length === 0) {
    return { allowed: false, reason: 'purpose_required' };
  }
  if (prompt.userBenefit.trim().length === 0) {
    return { allowed: false, reason: 'user_benefit_required' };
  }
  if (prompt.dataClass !== dataClassForProfileField(prompt.field)) {
    return { allowed: false, reason: 'data_class_mismatch' };
  }
  if (prompt.dataClass === 'sensitive_personal' && prompt.surface === 'onboarding') {
    return { allowed: false, reason: 'sensitive_data_not_allowed_in_initial_onboarding' };
  }
  if (prompt.blocking && prompt.canSkip) {
    return { allowed: false, reason: 'blocking_prompt_cannot_be_skippable' };
  }
  return { allowed: true };
}

export function initialOnboardingPrompts(): readonly ProfilePrompt[] {
  return [
    {
      field: 'preferred_name',
      purpose: 'personalize_addressing',
      userBenefit: 'Palta can address the person naturally.',
      surface: 'onboarding',
      dataClass: 'personal',
      blocking: false,
      canSkip: true,
    },
    {
      field: 'home_commune',
      purpose: 'local_relevance',
      userBenefit: 'Palta can prioritize relevant local information.',
      surface: 'onboarding',
      dataClass: 'personal',
      blocking: false,
      canSkip: true,
    },
  ];
}
