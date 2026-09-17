import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const spec = readFileSync('infra/api/openapi.preflight.yaml', 'utf8');
const timelinePath = '  /v1/messages/conversations/{conversationId}/timeline:';
const readPath = '  /v1/messages/conversations/{conversationId}/read:';
const start = spec.indexOf(timelinePath);
const end = spec.indexOf(readPath, start + timelinePath.length);

assert(start >= 0, 'OpenAPI must expose the authenticated read-only Conversation timeline.');
assert(end > start, 'Timeline path must remain a separate contract before the read-cursor endpoint.');

const timelineContract = spec.slice(start, end);
assert(/\n    get:\n/.test(timelineContract), 'Timeline contract must expose GET.');
assert(!/\n    post:\n/.test(timelineContract), 'Public clients must not POST domain-event projections.');
assert(
  timelineContract.includes('$ref: "#/components/schemas/TimelineListResponse"'),
  'Timeline GET must use the mixed TimelineListResponse schema.',
);

assert(spec.includes('    DomainTimelineEvent:\n'), 'OpenAPI must define durable domain-event references.');
assert(spec.includes('    TimelineMessageItem:\n'), 'OpenAPI must define message timeline items.');
assert(spec.includes('    TimelineDomainEventItem:\n'), 'OpenAPI must define domain-event timeline items.');
assert(spec.includes('    TimelineListResponse:\n'), 'OpenAPI must define timeline pagination response.');

const domainSchemaStart = spec.indexOf('    DomainTimelineEvent:\n');
const domainSchemaEnd = spec.indexOf('    TimelineMessageItem:\n', domainSchemaStart);
const domainSchema = spec.slice(domainSchemaStart, domainSchemaEnd);
for (const forbidden of ['phone:', 'email:', 'address:', 'body:', 'payment_payload:', 'order_payload:']) {
  assert(
    !domainSchema.toLowerCase().includes(forbidden),
    `Domain timeline reference schema must not copy ${forbidden}`,
  );
}

console.log('Message OpenAPI timeline contract tests passed.');
