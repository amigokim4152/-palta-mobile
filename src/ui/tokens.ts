export type TokenMaturity =
  | "approved_baseline"
  | "implementation_candidate"
  | "interface_ready_value_unfrozen"
  | "not_frozen"
  | "upstream_controlled";

export const tokenMaturity = {
  color: "interface_ready_value_unfrozen",
  typography: "interface_ready_value_unfrozen",
  spacing: "implementation_candidate",
  radius: "implementation_candidate",
  elevation: "implementation_candidate",
  motion: "approved_baseline",
  iconGeometry: "not_frozen",
  brandAssets: "upstream_controlled",
} as const satisfies Record<string, TokenMaturity>;

/**
 * Candidate values for prototype measurement only.
 * Domain code must consume semantic aliases rather than copying these numbers.
 * These values are not a brand freeze.
 */
export const spacingCandidate = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radiusCandidate = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export type ElevationRole = "flat" | "raised" | "floating" | "overlay";

/**
 * Elevation is semantic here. Platform adapters own the exact shadow/elevation
 * implementation so iOS, Android and Web can preserve the same meaning.
 */
export const elevationRoles: readonly ElevationRole[] = [
  "flat",
  "raised",
  "floating",
  "overlay",
] as const;

export type TypographyRole =
  | "display"
  | "titleLarge"
  | "titleMedium"
  | "titleSmall"
  | "bodyLarge"
  | "bodyMedium"
  | "bodySmall"
  | "labelLarge"
  | "labelMedium"
  | "labelSmall"
  | "caption"
  | "numericProminent";

export interface TypographyCandidate {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly weight: 400 | 500 | 600 | 700;
  readonly maxWeight?: 400 | 500 | 600 | 700;
}

/**
 * Candidate metrics for ES-CL/KO validation. Font family is intentionally absent.
 * It must be selected centrally and must support both locales well.
 */
export const typographyCandidate: Readonly<Record<TypographyRole, TypographyCandidate>> = {
  display: { fontSize: 32, lineHeight: 38, weight: 700 },
  titleLarge: { fontSize: 24, lineHeight: 30, weight: 700 },
  titleMedium: { fontSize: 20, lineHeight: 26, weight: 600 },
  titleSmall: { fontSize: 18, lineHeight: 24, weight: 600 },
  bodyLarge: { fontSize: 17, lineHeight: 25, weight: 400, maxWeight: 500 },
  bodyMedium: { fontSize: 15, lineHeight: 22, weight: 400, maxWeight: 500 },
  bodySmall: { fontSize: 14, lineHeight: 20, weight: 400, maxWeight: 500 },
  labelLarge: { fontSize: 15, lineHeight: 20, weight: 600 },
  labelMedium: { fontSize: 13, lineHeight: 18, weight: 600 },
  labelSmall: { fontSize: 12, lineHeight: 16, weight: 600 },
  caption: { fontSize: 12, lineHeight: 17, weight: 400, maxWeight: 500 },
  numericProminent: { fontSize: 28, lineHeight: 34, weight: 700 },
};

export const semanticColorKeys = [
  "background.base",
  "background.elevated",
  "surface.default",
  "surface.subtle",
  "surface.selected",
  "text.primary",
  "text.secondary",
  "text.tertiary",
  "text.inverse",
  "border.default",
  "border.strong",
  "action.primary",
  "action.secondary",
  "state.info",
  "state.success",
  "state.warning",
  "state.critical",
  "state.realtime",
  "state.stale",
  "state.disabled",
  "focus.ring",
] as const;

export type SemanticColorKey = (typeof semanticColorKeys)[number];

export type MotionRole = "micro" | "standard" | "spatial";

export interface MotionPolicy {
  readonly purpose: string;
  readonly durationFrozen: false;
  readonly respectsReduceMotion: true;
}

export const motionPolicy: Readonly<Record<MotionRole, MotionPolicy>> = {
  micro: {
    purpose: "Immediate state feedback such as press, selection or toggle.",
    durationFrozen: false,
    respectsReduceMotion: true,
  },
  standard: {
    purpose: "Local state continuity such as sheet, filter or tab content change.",
    durationFrozen: false,
    respectsReduceMotion: true,
  },
  spatial: {
    purpose: "Explain spatial continuity such as card-to-detail or map/list transitions.",
    durationFrozen: false,
    respectsReduceMotion: true,
  },
};

export const touchCandidate = {
  minimumTarget: 44,
  preferredPrimaryTarget: 48,
} as const;

export const layoutCandidate = {
  phoneHorizontalGutter: 16,
  compactHorizontalGutter: 12,
  sectionGap: 24,
  contentGap: 12,
  denseRowGap: 8,
} as const;
