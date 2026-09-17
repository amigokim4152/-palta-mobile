import { LocalBusinessQuoteCaseService } from '../src/verticalSlice/localBusinessQuoteCaseService.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls = {
  conversation: 0,
  scope: 0,
  care: 0,
  careLinks: [] as Array<Record<string, unknown>>,
  scopeLinks: [] as Array<Record<string, unknown>>,
};

const service = new LocalBusinessQuoteCaseService(
  {
    async openUserBusinessConversation(input) {
      calls.conversation += 1;
      return {
        conversation: {
          conversationId: 'conv-user-business-1',
          type: 'business' as const,
          createdAt: input.createdAt,
          lastSequence: 0,
          lastActivityAt: input.createdAt,
        },
        created: calls.conversation === 1,
      };
    },
  },
  {
    async ensureForPrimaryResource(input) {
      calls.scope += 1;
      assert(input.sourceCore === 'service-exchange', 'Quote Scope must retain owning source core.');
      assert(input.primaryResource.resourceType === 'quote_request', 'Quote request must be the primary work resource.');
      assert(input.authorizationEvidenceRef === 'quote-auth-1', 'Scope link must require domain authorization evidence.');
      return {
        scope: {
          scopeId: 'scope-service-1',
          conversationId: input.conversationId,
          scopeType: input.scopeType,
          state: 'active' as const,
          createdAt: input.createdAt,
        },
        created: calls.scope === 1,
      };
    },
    async attachAuthorizedResource(input) {
      calls.scopeLinks.push({ ...input });
      return input;
    },
  },
  {
    async start(input) {
      calls.care += 1;
      assert(input.mode === 'confirmed_action', 'Quote submission must create Care as a confirmed action.');
      assert(input.clientRequestId === 'mutation-quote-1', 'Offline mutation ID must be Care idempotency identity.');
      return {
        track: { id: 'care-service-1', state: 'action_started' as const },
        created: calls.care === 1,
      };
    },
  },
  {
    async link(input) {
      calls.careLinks.push({ ...input });
      return { replayed: calls.careLinks.length > 1 };
    },
  },
);

const command = {
  principalUserId: 'user-1',
  businessId: 'business-1',
  quoteRequestId: 'quote-request-1',
  quoteAuthorizationEvidenceRef: 'quote-auth-1',
  clientRequestId: 'mutation-quote-1',
  createdAt: '2026-09-17T20:00:00.000Z',
  label: 'Honda · 앞범퍼 수리',
};

const first = await service.start(command);
assert(first.conversationId === 'conv-user-business-1', 'Quote case must use the durable user-business conversation.');
assert(first.scopeId === 'scope-service-1', 'Quote case must use one service-case scope.');
assert(first.careTrackId === 'care-service-1', 'Quote case must link one service Care track.');
assert(first.conversationCreated && first.scopeCreated && first.careCreated, 'First integration pass must report newly created identities.');

const retry = await service.start(command);
assert(!retry.conversationCreated && !retry.scopeCreated && !retry.careCreated, 'Retry must reuse relationship, scope and Care identities.');
assert(retry.conversationId === first.conversationId, 'Retry must preserve conversation identity.');
assert(retry.scopeId === first.scopeId, 'Retry must preserve scope identity.');
assert(retry.careTrackId === first.careTrackId, 'Retry must preserve Care identity.');

await service.attachAppointment({
  principalUserId: 'user-1',
  conversationId: first.conversationId,
  scopeId: first.scopeId,
  careTrackId: first.careTrackId,
  appointmentId: 'appointment-1',
  appointmentAuthorizationEvidenceRef: 'appointment-auth-1',
  linkedAt: '2026-09-17T20:35:00.000Z',
});
assert(Number(calls.scopeLinks.length) === 1, 'Appointment must attach once to the existing service Scope.');
assert(calls.scopeLinks[0]?.relation === 'booking', 'Appointment Scope relation must be booking.');
assert(calls.scopeLinks[0]?.scopeId === first.scopeId, 'Appointment must not create a second service Scope.');
assert(
  calls.careLinks.some(
    (link) =>
      link.sourceCore === 'service-appointment' &&
      link.resourceType === 'service_appointment' &&
      link.resourceId === 'appointment-1',
  ),
  'Appointment must be linked to the same Care track before lifecycle events are emitted.',
);

const serialized = JSON.stringify({ first, retry, scopeLinks: calls.scopeLinks, careLinks: calls.careLinks }).toLowerCase();
for (const forbidden of ['phone', 'email', 'address', 'whatsapp', 'paymentpayload']) {
  assert(!serialized.includes(forbidden), `Quote case orchestration must not copy ${forbidden}.`);
}

console.log('Local business quote case orchestration tests passed.');
