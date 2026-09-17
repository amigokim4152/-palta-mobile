import {
  projectCareMachineState,
  projectCareTrack,
} from '../src/care/careStageProjection.js';
import type { CareState, CareTrack } from '../src/care/careMachine.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const expectations: Array<{
  state: CareState;
  stage: ReturnType<typeof projectCareMachineState>['stage'];
  terminal?: boolean;
}> = [
  { state: 'discovered', stage: 'discover' },
  { state: 'preparing', stage: 'prepare' },
  { state: 'action_started', stage: 'act' },
  { state: 'waiting', stage: 'wait' },
  { state: 'upcoming', stage: 'wait' },
  { state: 'in_progress', stage: 'act' },
  { state: 'result_available', stage: 'result' },
  { state: 'completed', stage: 'result' },
  { state: 'follow_up', stage: 'follow_up' },
  { state: 'outcome_recorded', stage: 'outcome', terminal: true },
  { state: 'blocked', stage: 'prepare' },
  { state: 'cancelled', stage: 'cancelled', terminal: true },
];

for (const expectation of expectations) {
  const projection = projectCareMachineState(expectation.state);
  assert(
    projection.stage === expectation.stage,
    `${expectation.state} must project to ${expectation.stage}.`,
  );
  assert(
    projection.terminal === Boolean(expectation.terminal),
    `${expectation.state} terminal projection mismatch.`,
  );
}

const blocked = projectCareMachineState('blocked');
assert(blocked.blocked, 'Blocked must remain explicit instead of inventing a public lifecycle stage.');

const scheduled: CareTrack = {
  id: 'care-1',
  state: 'action_started',
  expectedAt: '2026-09-18T10:00:00.000Z',
};
const scheduledProjection = projectCareTrack(scheduled);
assert(
  scheduledProjection.stage === 'act' && scheduledProjection.waiting,
  'Expected time must be an orthogonal waiting signal without changing the internal machine state.',
);

console.log('Care stage projection tests passed.');
