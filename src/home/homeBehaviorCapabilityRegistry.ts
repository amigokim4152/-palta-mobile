export type HomeBehaviorCapabilityStatus =
  | 'done'
  | 'partial'
  | 'pending_runtime';

export type HomeBehaviorCapability = {
  key: string;
  status: HomeBehaviorCapabilityStatus;
  owner: string;
  description: string;
};

/**
 * Cross-cutting Home behavior. These are not visual cards; they are product
 * behaviors that every data source must inherit as it replaces demo data.
 */
export const HOME_BEHAVIOR_CAPABILITIES: readonly HomeBehaviorCapability[] = [
  {
    key: 'behavior.context_resolution',
    status: 'done',
    owner: 'Home/Location',
    description: 'Resolve explicit, home, current and saved locality without turning GPS into a durable home fact.',
  },
  {
    key: 'behavior.subject_scope',
    status: 'done',
    owner: 'Home/Profile',
    description: 'Keep person, household, vehicle, pet, business and place subject identity on personalized items.',
  },
  {
    key: 'behavior.personalization_correction',
    status: 'done',
    owner: 'Home/Relevance',
    description: 'Support not relevant, wrong subject, already done, incorrect information and hide-type feedback.',
  },
  {
    key: 'behavior.exact_deep_link',
    status: 'done',
    owner: 'Home/Routing',
    description: 'Action items must open the exact process/entity; fake action buttons are invalid.',
  },
  {
    key: 'behavior.source_freshness',
    status: 'done',
    owner: 'Home/Data',
    description: 'Track live, cached, scheduled, demo and unavailable source state with validity windows.',
  },
  {
    key: 'behavior.no_fabricated_fallback',
    status: 'done',
    owner: 'Home/Data',
    description: 'Unavailable live data never silently falls back to a made-up realtime value.',
  },
  {
    key: 'behavior.dedupe_cluster',
    status: 'done',
    owner: 'Home/Composer',
    description: 'Duplicate real-world events are collapsed before rendering.',
  },
  {
    key: 'behavior.priority_density',
    status: 'done',
    owner: 'Home/Composer',
    description: 'Personal/action state outranks generic content; discovery is reduced on busy days.',
  },
  {
    key: 'behavior.completion_reconciliation',
    status: 'done',
    owner: 'Home/Care',
    description: 'Completed/cancelled domain state disappears or transforms only after the owning core confirms it.',
  },
  {
    key: 'behavior.notification_escalation',
    status: 'partial',
    owner: 'Notification/Event',
    description: 'Home-worthy does not imply push-worthy; only meaningful state change, urgency or user-requested alerts escalate.',
  },
  {
    key: 'behavior.notification_inbox_sync',
    status: 'done',
    owner: 'Notification/Home',
    description: 'Unread count and read transitions are reflected when Home regains focus.',
  },
  {
    key: 'behavior.cached_startup',
    status: 'done',
    owner: 'Home/Cache',
    description: 'Last-known Home may render before refresh while stale realtime signals are filtered independently.',
  },
  {
    key: 'behavior.offline_mutation_queue',
    status: 'pending_runtime',
    owner: 'Platform Runtime',
    description: 'Supported user actions queue safely while offline instead of pretending they completed.',
  },
  {
    key: 'behavior.quiet_state',
    status: 'done',
    owner: 'Home/Composer',
    description: 'An empty Home is valid; Palta does not manufacture tasks or filler.',
  },
  {
    key: 'behavior.focus_refresh',
    status: 'done',
    owner: 'Home/Runtime',
    description: 'Returning from a detail/action surface refreshes Home state.',
  },
  {
    key: 'behavior.demo_live_separation',
    status: 'done',
    owner: 'Home/Development',
    description: 'Complete demo data is explicitly marked and can be replaced source-by-source without changing semantics.',
  },
] as const;

export function homeBehaviorCapability(key: string): HomeBehaviorCapability | undefined {
  return HOME_BEHAVIOR_CAPABILITIES.find((capability) => capability.key === key);
}
