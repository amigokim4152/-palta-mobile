import { buildCareHomeCandidate } from '../src/care/careHomeCandidatePolicy.js';
import type { CareTrack } from '../src/care/careMachine.js';
import { resolveDelivery } from '../src/notification/deliveryPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const waiting: CareTrack = {
  id: 'care-waiting',
  state: 'waiting',
  waitingFor: 'delivery_arrival',
  expectedAt: '2026-09-18T16:00:00.000Z',
};
const waitingCandidate = buildCareHomeCandidate(waiting, {
  id: 'candidate-waiting',
  domain: 'local',
  title: '배송을 기다리고 있습니다',
  sourceRef: 'shipment:44',
});
assert(waitingCandidate?.kind === 'status', 'Waiting Care must be a status, not a fake action.');
assert(waitingCandidate?.waitingState, 'Waiting Care must preserve waiting state for Home ranking.');
assert(resolveDelivery(waitingCandidate) === 'home', 'Ordinary waiting must stay Home-only by default.');

const blocked: CareTrack = {
  id: 'care-blocked',
  state: 'blocked',
  waitingFor: 'customer_confirmation',
};
const blockedCandidate = buildCareHomeCandidate(blocked, {
  id: 'candidate-blocked',
  domain: 'vehicle',
  title: '확인이 필요합니다',
  action: {
    label: '확인하기',
    target: '/care/care-blocked',
    kind: 'internal',
  },
});
assert(blockedCandidate?.kind === 'action', 'Blocked Care must surface as an action candidate.');
assert(blockedCandidate?.actionRequired, 'Blocked Care must require action.');
assert(
  resolveDelivery(blockedCandidate) === 'home',
  'Blocked Care must not automatically become a push without higher urgency policy.',
);

const urgentBlocked = buildCareHomeCandidate(blocked, {
  id: 'candidate-blocked-urgent',
  domain: 'vehicle',
  title: '오늘 확인이 필요합니다',
  urgency: 3,
  action: {
    label: '확인하기',
    target: '/care/care-blocked',
    kind: 'internal',
  },
});
assert(
  urgentBlocked !== null && resolveDelivery(urgentBlocked) === 'home_notify',
  'Domain policy may explicitly raise a truly time-sensitive Care action to notification.',
);

const outcome: CareTrack = {
  id: 'care-done',
  state: 'outcome_recorded',
};
assert(
  buildCareHomeCandidate(outcome, {
    id: 'candidate-done',
    domain: 'vehicle',
    title: '처리가 완료되었습니다',
  }) === null,
  'Terminal Care must not keep filling Home by default.',
);

const terminalIncluded = buildCareHomeCandidate(outcome, {
  id: 'candidate-done-once',
  domain: 'vehicle',
  title: '처리가 완료되었습니다',
  includeTerminal: true,
  validUntil: '2026-09-18T21:00:00.000Z',
});
assert(terminalIncluded?.kind === 'status', 'A domain may intentionally show a recent terminal result once.');
assert(resolveDelivery(terminalIncluded) === 'home', 'Terminal completion remains Home-only unless explicitly escalated.');

console.log('Care Home candidate policy tests passed.');
