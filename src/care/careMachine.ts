export type CareState =
  | 'discovered'
  | 'preparing'
  | 'action_started'
  | 'waiting'
  | 'upcoming'
  | 'in_progress'
  | 'result_available'
  | 'completed'
  | 'follow_up'
  | 'outcome_recorded'
  | 'blocked'
  | 'cancelled';

export type CareEvent =
  | 'prepare'
  | 'start_action'
  | 'wait'
  | 'schedule'
  | 'begin'
  | 'result_received'
  | 'complete'
  | 'require_follow_up'
  | 'record_outcome'
  | 'block'
  | 'resume'
  | 'cancel';

const transitions: Record<CareState, Partial<Record<CareEvent, CareState>>> = {
  discovered: { prepare: 'preparing', start_action: 'action_started', cancel: 'cancelled' },
  preparing: { start_action: 'action_started', block: 'blocked', cancel: 'cancelled' },
  action_started: { wait: 'waiting', schedule: 'upcoming', begin: 'in_progress', block: 'blocked', cancel: 'cancelled' },
  waiting: { schedule: 'upcoming', result_received: 'result_available', block: 'blocked', cancel: 'cancelled' },
  upcoming: { begin: 'in_progress', block: 'blocked', cancel: 'cancelled' },
  in_progress: { result_received: 'result_available', complete: 'completed', block: 'blocked', cancel: 'cancelled' },
  result_available: { complete: 'completed', require_follow_up: 'follow_up', block: 'blocked' },
  completed: { require_follow_up: 'follow_up', record_outcome: 'outcome_recorded' },
  follow_up: { start_action: 'action_started', complete: 'completed', record_outcome: 'outcome_recorded', block: 'blocked' },
  outcome_recorded: {},
  blocked: { resume: 'preparing', cancel: 'cancelled' },
  cancelled: {},
};

export interface CareTrack {
  id: string;
  state: CareState;
  result?: { code?: string; summary: string; observedAt: string };
  outcome?: { summary: string; recordedAt: string };
  waitingFor?: string;
  expectedAt?: string;
  nextCheckAt?: string;
}

export function transitionCare(track: CareTrack, event: CareEvent): CareTrack {
  const next = transitions[track.state][event];
  if (!next) throw new Error(`Invalid care transition: ${track.state} -> ${event}`);
  return { ...track, state: next };
}

export function attachResult(
  track: CareTrack,
  result: NonNullable<CareTrack['result']>,
): CareTrack {
  if (track.state !== 'result_available' && track.state !== 'in_progress' && track.state !== 'waiting') {
    throw new Error('Result can only be attached while waiting, in progress, or result_available.');
  }
  return { ...track, state: 'result_available', result };
}

export function recordOutcome(
  track: CareTrack,
  outcome: NonNullable<CareTrack['outcome']>,
): CareTrack {
  if (track.state !== 'completed' && track.state !== 'follow_up' && track.state !== 'outcome_recorded') {
    throw new Error('Outcome requires completed or follow-up state.');
  }
  return { ...track, state: 'outcome_recorded', outcome };
}
