export type HomeZone = "now" | "in_progress" | "useful_today" | "discover";

export type HomeCardKind =
  | "action"
  | "status"
  | "alert"
  | "useful"
  | "content";

export type HomeUiItem = {
  id: string;
  zone: HomeZone;
  kind: HomeCardKind;
  title: string;
  body?: string;
  sourceDomain: string;
  relatedEntityId?: string;
  careTrackId?: string;
  actionLabel?: string;
  actionTarget?: string;
  validUntil?: string;
};

export type HomeUiState = {
  items: HomeUiItem[];
  isRefreshing: boolean;
  isOffline: boolean;
  lastUpdatedAt?: string;
  scrollOffset?: number;
};
