export type IconCategory =
  | "navigation"
  | "action"
  | "status"
  | "domain"
  | "utility"
  | "trust";

export interface IconDefinition {
  readonly key: string;
  readonly category: IconCategory;
  readonly meaning: string;
  readonly aliases?: readonly string[];
  readonly branded: true;
  readonly unicodeEmojiFallbackAllowed: false;
}

export const coreIcons = [
  { key: "home", category: "navigation", meaning: "Home / personal relevant surface", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "neighborhood", category: "navigation", meaning: "Neighborhood / local context", aliases: ["local"], branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "community", category: "navigation", meaning: "Community spaces and groups", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "market", category: "navigation", meaning: "Marketplace / discovery", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "play", category: "navigation", meaning: "Panoramas / leisure discovery", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "search", category: "action", meaning: "Search", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "back", category: "action", meaning: "Return to previous state", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "close", category: "action", meaning: "Close current transient surface", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "more", category: "action", meaning: "More contextual actions", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "add", category: "action", meaning: "Create or add", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "edit", category: "action", meaning: "Edit", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "share", category: "action", meaning: "Share", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "save", category: "action", meaning: "Save / bookmark", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "send", category: "action", meaning: "Send message or submission", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "filter", category: "action", meaning: "Filter results", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "sort", category: "action", meaning: "Sort results", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "location", category: "utility", meaning: "Location / place", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "current-location", category: "utility", meaning: "Current device/user location", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "map", category: "utility", meaning: "Map surface", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "calendar", category: "utility", meaning: "Date / schedule", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "clock", category: "utility", meaning: "Time / opening hours", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "photo", category: "utility", meaning: "Photo / media", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "camera", category: "utility", meaning: "Capture photo", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "attachment", category: "utility", meaning: "Attachment", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "message", category: "domain", meaning: "Messaging / conversation", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "business", category: "domain", meaning: "Business / merchant", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "transport", category: "domain", meaning: "Transport / mobility", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "health", category: "domain", meaning: "Health", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "school", category: "domain", meaning: "School / education", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "pet", category: "domain", meaning: "Pet", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "property", category: "domain", meaning: "Property / real estate", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "job", category: "domain", meaning: "Job / employment", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "verified", category: "trust", meaning: "Verified identity/source", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "shield", category: "trust", meaning: "Protection / privacy / controlled access", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "info", category: "status", meaning: "Information", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "success", category: "status", meaning: "Successful meaningful completion", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "warning", category: "status", meaning: "Attention / warning", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "critical", category: "status", meaning: "Critical/error state", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "realtime", category: "status", meaning: "Live/realtime state", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "stale", category: "status", meaning: "Potentially outdated data", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "offline", category: "status", meaning: "Offline/degraded network state", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "report", category: "action", meaning: "Report content or user", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "block", category: "action", meaning: "Block user/entity", branded: true, unicodeEmojiFallbackAllowed: false },
  { key: "mute", category: "action", meaning: "Mute notifications/content", branded: true, unicodeEmojiFallbackAllowed: false }
] as const satisfies readonly IconDefinition[];

export type CoreIconKey = (typeof coreIcons)[number]["key"];

export function isCoreIconKey(value: string): value is CoreIconKey {
  return coreIcons.some((icon) => icon.key === value);
}

export const iconPolicy = {
  oneCanonicalMeaningPerKey: true,
  domainSpecificPacksAllowed: false,
  unicodeEmojiForCoreUiAllowed: false,
  userEnteredEmojiAllowed: true,
  geometryFrozen: false,
  requiredVisualProperties: [
    "consistent optical weight",
    "consistent bounding box",
    "consistent alignment",
    "legible at small mobile sizes",
    "recognizable without color",
  ],
} as const;
