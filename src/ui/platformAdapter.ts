import type {
  BottomSheetContract,
  CharacterPresentationContract,
  ContentCardContract,
  EmptyStateContract,
  ErrorStateContract,
  PaltaButtonContract,
  PaltaIconContract,
  PaltaInputContract,
  PaltaTextContract,
  ReactionBarContract,
  StatusBadgeContract,
  TrustStatusContract,
} from "./contracts.js";

export type UiPlatform = "ios" | "android" | "web";

export interface PaltaPlatformCapabilities {
  readonly platform: UiPlatform;
  readonly supportsHaptics: boolean;
  readonly supportsNativeBackGesture: boolean;
  readonly supportsSafeArea: boolean;
  readonly supportsReducedMotionPreference: boolean;
  readonly supportsDynamicText: boolean;
}

export interface PaltaUiPlatformAdapter<RenderNode = unknown> {
  readonly capabilities: PaltaPlatformCapabilities;
  readonly renderText: (contract: PaltaTextContract) => RenderNode;
  readonly renderIcon: (contract: PaltaIconContract) => RenderNode;
  readonly renderButton: (contract: PaltaButtonContract) => RenderNode;
  readonly renderInput: (contract: PaltaInputContract) => RenderNode;
  readonly renderCard: (contract: ContentCardContract) => RenderNode;
  readonly renderBottomSheet: (contract: BottomSheetContract) => RenderNode;
  readonly renderStatusBadge: (contract: StatusBadgeContract) => RenderNode;
  readonly renderTrustStatus: (contract: TrustStatusContract) => RenderNode;
  readonly renderReactionBar: (contract: ReactionBarContract) => RenderNode;
  readonly renderCharacter: (contract: CharacterPresentationContract) => RenderNode;
  readonly renderEmptyState: (contract: EmptyStateContract) => RenderNode;
  readonly renderErrorState: (contract: ErrorStateContract) => RenderNode;
}

export interface PlatformAdapterValidation {
  readonly locale: "es-CL" | "ko";
  readonly textScale: number;
  readonly reducedMotion: boolean;
  readonly offline: boolean;
  readonly requiredEvidence: readonly (
    | "screenshot"
    | "screen_reader"
    | "interaction_recording"
    | "performance_trace"
    | "manual_device_note"
  )[];
}

export const REQUIRED_NATIVE_ADAPTER_VALIDATIONS: readonly PlatformAdapterValidation[] = [
  {
    locale: "es-CL",
    textScale: 1,
    reducedMotion: false,
    offline: false,
    requiredEvidence: ["screenshot", "interaction_recording"],
  },
  {
    locale: "es-CL",
    textScale: 1.3,
    reducedMotion: true,
    offline: false,
    requiredEvidence: ["screenshot", "screen_reader", "manual_device_note"],
  },
  {
    locale: "ko",
    textScale: 1,
    reducedMotion: false,
    offline: false,
    requiredEvidence: ["screenshot", "interaction_recording"],
  },
  {
    locale: "ko",
    textScale: 1.3,
    reducedMotion: true,
    offline: true,
    requiredEvidence: ["screenshot", "screen_reader", "manual_device_note"],
  },
];
