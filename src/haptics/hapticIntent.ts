export type HapticIntent =
  | 'none'
  | 'selection_confirmed'
  | 'success'
  | 'warning'
  | 'error';

export type HapticEvent =
  | 'navigate'
  | 'open_detail'
  | 'filter_toggle'
  | 'map_select'
  | 'important_choice_confirmed'
  | 'server_action_succeeded'
  | 'offline_queued'
  | 'important_action_failed'
  | 'risk_conflict';

export function hapticIntentForEvent(
  event: HapticEvent,
): HapticIntent {
  switch (event) {
    case 'important_choice_confirmed':
      return 'selection_confirmed';
    case 'server_action_succeeded':
      return 'success';
    case 'important_action_failed':
      return 'error';
    case 'risk_conflict':
      return 'warning';
    case 'offline_queued':
    case 'navigate':
    case 'open_detail':
    case 'filter_toggle':
    case 'map_select':
      return 'none';
  }
}
