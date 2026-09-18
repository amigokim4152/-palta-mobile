import {
  HOME_BEHAVIOR_CAPABILITIES,
  homeBehaviorCapability,
} from '../src/home/homeBehaviorCapabilityRegistry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const keys = HOME_BEHAVIOR_CAPABILITIES.map((item) => item.key);
assert(new Set(keys).size === keys.length, 'Home behavior capability keys must be unique');
assert(keys.length >= 15, 'Home behavior registry is unexpectedly incomplete');

for (const key of [
  'behavior.context_resolution',
  'behavior.subject_scope',
  'behavior.personalization_correction',
  'behavior.exact_deep_link',
  'behavior.source_freshness',
  'behavior.no_fabricated_fallback',
  'behavior.dedupe_cluster',
  'behavior.priority_density',
  'behavior.completion_reconciliation',
  'behavior.notification_escalation',
  'behavior.notification_inbox_sync',
  'behavior.cached_startup',
  'behavior.offline_mutation_queue',
  'behavior.quiet_state',
  'behavior.focus_refresh',
  'behavior.demo_live_separation',
]) {
  assert(homeBehaviorCapability(key), `Required Home behavior missing: ${key}`);
}

assert(
  homeBehaviorCapability('behavior.offline_mutation_queue')?.status === 'pending_runtime',
  'Offline mutation queue must remain explicitly pending until runtime support exists',
);
assert(
  homeBehaviorCapability('behavior.notification_escalation')?.status === 'partial',
  'Notification escalation must not be reported as complete before live Event Core integration',
);

console.log(`PASS: Home behavior capability registry (${keys.length} behaviors)`);
