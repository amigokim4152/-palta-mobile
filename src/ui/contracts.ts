import type { CoreIconKey } from "./icons.js";
import type { TypographyRole } from "./tokens.js";

export type UiStateTone = "neutral" | "info" | "success" | "warning" | "critical";
export type TrustState = "verified" | "unverified" | "pending" | "stale" | "unknown";
export type FreshnessState = "current" | "realtime" | "stale" | "unknown";

export interface PaltaTextContract {
  readonly role: TypographyRole;
  readonly text: string;
  readonly maxLines?: number;
  readonly accessibilityLabel?: string;
}

export interface PaltaIconContract {
  readonly icon: CoreIconKey;
  readonly accessibilityLabel?: string;
  readonly decorative?: boolean;
}

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonState = "default" | "pressed" | "loading" | "success" | "disabled" | "error";

export interface PaltaButtonContract {
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly state: ButtonState;
  readonly leadingIcon?: CoreIconKey;
  readonly trailingIcon?: CoreIconKey;
  readonly destructive?: boolean;
  readonly accessibilityHint?: string;
}

export type InputState = "idle" | "focused" | "filled" | "disabled" | "error";

export interface PaltaInputContract {
  readonly label: string;
  readonly value: string;
  readonly state: InputState;
  readonly placeholder?: string;
  readonly supportingText?: string;
  readonly errorText?: string;
  readonly leadingIcon?: CoreIconKey;
  readonly trailingIcon?: CoreIconKey;
}

export type CardState = "default" | "pressed" | "selected" | "disabled" | "stale";

export interface ContentCardContract {
  readonly id: string;
  readonly title?: string;
  readonly body?: string;
  readonly state: CardState;
  readonly freshness?: FreshnessState;
  readonly trust?: TrustState;
  readonly primaryAction?: PaltaButtonContract;
  readonly secondaryAction?: PaltaButtonContract;
}

export type SheetState = "peek" | "half" | "full" | "loading" | "empty" | "degraded";

export interface BottomSheetContract {
  readonly state: SheetState;
  readonly title?: string;
  readonly dismissible: boolean;
  readonly preservesContext: true;
  readonly primaryAction?: PaltaButtonContract;
}

export interface StatusBadgeContract {
  readonly label: string;
  readonly tone: UiStateTone;
  readonly freshness?: FreshnessState;
  readonly icon?: CoreIconKey;
}

export interface TrustStatusContract {
  readonly state: TrustState;
  readonly label?: string;
  readonly sourceName?: string;
  readonly checkedAt?: string;
}

export type EmptyStateMode = "neutral" | "actionable" | "living_example_available";

export interface EmptyStateContract {
  readonly mode: EmptyStateMode;
  readonly title: string;
  readonly body?: string;
  readonly action?: PaltaButtonContract;
  readonly characterAssetId?: string;
}

export type ErrorStateKind = "retryable" | "offline" | "permission" | "fatal";

export interface ErrorStateContract {
  readonly kind: ErrorStateKind;
  readonly title: string;
  readonly body?: string;
  readonly retryAction?: PaltaButtonContract;
}

export interface ProfileIdentityContract {
  readonly profileId: string;
  readonly displayName: string;
  readonly profileType: "person" | "business" | "organization" | "public" | "palta_example";
  readonly imageAssetId?: string;
  readonly trust: TrustState;
  readonly synthetic: boolean;
}

export interface CommunityPostContract {
  readonly postId: string;
  readonly author: ProfileIdentityContract;
  readonly body: string;
  readonly createdAt: string;
  readonly moderated: boolean;
  readonly hidden: boolean;
  readonly reactionKeys: readonly string[];
  readonly commentCount: number;
}

export interface LocalResultContract {
  readonly entityId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly distanceMeters?: number;
  readonly openState?: "open" | "closed" | "unknown";
  readonly trust: TrustState;
  readonly freshness: FreshnessState;
  readonly selected: boolean;
}

export interface ScreenPatternContract {
  readonly name:
    | "home-relevant-action"
    | "discovery"
    | "map-sheet"
    | "feed-thread"
    | "detail-action"
    | "timeline-care"
    | "progressive-form"
    | "conversation-context";
  readonly dominantPurpose: string;
  readonly allowsDensePortalGrid: false;
  readonly preservesNavigationContext: true;
}
