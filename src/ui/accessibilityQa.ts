export type AccessibilityCheckId =
  | "touch-target"
  | "dynamic-text"
  | "contrast"
  | "screen-reader-label"
  | "focus-order"
  | "reduced-motion"
  | "state-not-color-only"
  | "keyboard-visibility"
  | "safe-area"
  | "back-state-restoration";

export interface AccessibilityCheck {
  readonly id: AccessibilityCheckId;
  readonly required: true;
  readonly automated: boolean;
  readonly deviceValidationRequired: boolean;
  readonly description: string;
}

export const ACCESSIBILITY_CHECKS: readonly AccessibilityCheck[] = [
  {
    id: "touch-target",
    required: true,
    automated: true,
    deviceValidationRequired: true,
    description: "Interactive controls meet the centralized minimum touch-target contract.",
  },
  {
    id: "dynamic-text",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "Text scaling does not clip primary meaning or make core actions unreachable.",
  },
  {
    id: "contrast",
    required: true,
    automated: true,
    deviceValidationRequired: true,
    description: "Text, icons and focus states meet the approved contrast gate once brand colors are frozen.",
  },
  {
    id: "screen-reader-label",
    required: true,
    automated: true,
    deviceValidationRequired: true,
    description: "Non-text controls expose meaningful labels and decorative assets are ignored.",
  },
  {
    id: "focus-order",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "Focus follows reading/action order rather than visual implementation order.",
  },
  {
    id: "reduced-motion",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "OS Reduce Motion preferences remove nonessential motion while preserving state feedback.",
  },
  {
    id: "state-not-color-only",
    required: true,
    automated: true,
    deviceValidationRequired: true,
    description: "Success, warning, critical, selected and stale states are not communicated by color alone.",
  },
  {
    id: "keyboard-visibility",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "Keyboard appearance does not cover the primary action or cause unstable layout jumps.",
  },
  {
    id: "safe-area",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "Primary controls and navigation respect platform safe areas.",
  },
  {
    id: "back-state-restoration",
    required: true,
    automated: false,
    deviceValidationRequired: true,
    description: "Back navigation restores meaningful list, filter and map context where possible.",
  },
];

export interface UiQaResult {
  readonly checkId: AccessibilityCheckId;
  readonly status: "pass" | "fail" | "not_verified";
  readonly evidence?: string;
}

export function hasUnverifiedRequiredChecks(results: readonly UiQaResult[]): boolean {
  const resultById = new Map(results.map((result) => [result.checkId, result] as const));
  return ACCESSIBILITY_CHECKS.some((check) => resultById.get(check.id)?.status !== "pass");
}
