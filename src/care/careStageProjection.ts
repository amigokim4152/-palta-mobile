import type { CareState as CareMachineState, CareTrack } from './careMachine.js';

/**
 * Stable coarse stage exposed to Home/API/timeline UI.
 * The Care machine may keep finer internal states without leaking them into
 * public contracts or forcing UI migrations.
 */
export type CareDisplayStage =
  | 'discover'
  | 'prepare'
  | 'act'
  | 'wait'
  | 'result'
  | 'follow_up'
  | 'outcome'
  | 'cancelled';

export interface CareStageProjection {
  stage: CareDisplayStage;
  blocked: boolean;
  waiting: boolean;
  terminal: boolean;
}

export function projectCareMachineState(
  state: CareMachineState,
): CareStageProjection {
  switch (state) {
    case 'discovered':
      return { stage: 'discover', blocked: false, waiting: false, terminal: false };
    case 'preparing':
      return { stage: 'prepare', blocked: false, waiting: false, terminal: false };
    case 'action_started':
    case 'in_progress':
      return { stage: 'act', blocked: false, waiting: false, terminal: false };
    case 'waiting':
    case 'upcoming':
      return { stage: 'wait', blocked: false, waiting: true, terminal: false };
    case 'result_available':
    case 'completed':
      return { stage: 'result', blocked: false, waiting: false, terminal: false };
    case 'follow_up':
      return { stage: 'follow_up', blocked: false, waiting: false, terminal: false };
    case 'outcome_recorded':
      return { stage: 'outcome', blocked: false, waiting: false, terminal: true };
    case 'blocked':
      // Blocked is an orthogonal condition, not a new public lifecycle stage.
      // Keep it visible via the blocked flag while retaining a stable stage.
      return { stage: 'prepare', blocked: true, waiting: false, terminal: false };
    case 'cancelled':
      return { stage: 'cancelled', blocked: false, waiting: false, terminal: true };
  }
}

export function projectCareTrack(track: CareTrack): CareStageProjection {
  const projection = projectCareMachineState(track.state);
  return {
    ...projection,
    waiting: projection.waiting || Boolean(track.waitingFor || track.expectedAt),
  };
}
