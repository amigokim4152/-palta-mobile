export type PresentationSignal = {
  urgency: 0 | 1 | 2 | 3;
  relevance: 0 | 1 | 2 | 3;
  actionRequired: 0 | 1 | 2 | 3;
  risk: 0 | 1 | 2 | 3;
  freshness: 0 | 1 | 2 | 3;
  frequency: 0 | 1 | 2 | 3;
};

export type PresentationTier =
  | 'focus'
  | 'primary'
  | 'secondary'
  | 'glance'
  | 'discover';

export type PresentationSurface =
  | 'inline'
  | 'glance_cluster'
  | 'list_row'
  | 'action_surface'
  | 'timeline'
  | 'bottom_sheet'
  | 'full_screen'
  | 'alert';

export type PresentationDecision = {
  tier: PresentationTier;
  preferredSurface: PresentationSurface;
  mayHideFromInitialViewport: boolean;
};

export function priorityScore(signal: PresentationSignal): number {
  // Risk/action/urgency intentionally dominate freshness/frequency.
  return (
    signal.urgency * 4 +
    signal.relevance * 3 +
    signal.actionRequired * 4 +
    signal.risk * 5 +
    signal.freshness * 1 +
    signal.frequency * 1
  );
}

export function decidePresentation(
  signal: PresentationSignal,
): PresentationDecision {
  const score = priorityScore(signal);

  if (signal.risk >= 3 || (signal.urgency >= 3 && signal.actionRequired >= 2)) {
    return {
      tier: 'focus',
      preferredSurface: signal.risk >= 3 ? 'alert' : 'action_surface',
      mayHideFromInitialViewport: false,
    };
  }

  if (score >= 28) {
    return {
      tier: 'primary',
      preferredSurface:
        signal.actionRequired >= 2 ? 'action_surface' : 'list_row',
      mayHideFromInitialViewport: false,
    };
  }

  if (score >= 18) {
    return {
      tier: 'secondary',
      preferredSurface:
        signal.frequency >= 2 && signal.actionRequired <= 1
          ? 'glance_cluster'
          : 'list_row',
      mayHideFromInitialViewport: false,
    };
  }

  if (signal.frequency >= 2 && signal.risk === 0) {
    return {
      tier: 'glance',
      preferredSurface: 'glance_cluster',
      mayHideFromInitialViewport: true,
    };
  }

  return {
    tier: 'discover',
    preferredSurface: 'list_row',
    mayHideFromInitialViewport: true,
  };
}
