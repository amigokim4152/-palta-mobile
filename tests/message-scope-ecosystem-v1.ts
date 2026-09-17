import { buildDomainActionRequest } from '../src/messaging/actionBridge.js';
import {
  buildEcosystemLinkRequest,
  scopeResourceFromAuthorizedLink,
} from '../src/messaging/ecosystemBridge.js';
import {
  addScopeResource,
  createConversationScope,
  primaryScopeResource,
} from '../src/messaging/scope.js';
import { InMemoryMessageStore } from '../src/messaging/store.js';
import type { ConversationScopeResourceRef } from '../src/messaging/contracts.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = '2026-09-17T19:00:00.000Z';
const conversationId = 'conv-user-taller-abc';

const hondaScope = createConversationScope({
  scopeId: 'scope-honda-bumper',
  conversationId,
  scopeType: 'service_case',
  label: 'Honda · front bumper',
  state: 'active',
  createdAt: now,
});
const nissanScope = createConversationScope({
  scopeId: 'scope-nissan-maintenance',
  conversationId,
  scopeType: 'service_case',
  label: 'Nissan · maintenance',
  state: 'active',
  createdAt: now,
});
assert(hondaScope.conversationId === nissanScope.conversationId, 'One durable relationship conversation must support multiple independent scopes.');
assert(hondaScope.scopeId !== nissanScope.scopeId, 'Separate jobs must not collapse into one scope.');

let hondaResources: ConversationScopeResourceRef[] = [];
hondaResources = addScopeResource(hondaResources, {
  scopeId: hondaScope.scopeId,
  relation: 'primary',
  resourceType: 'service_request',
  resourceId: 'service-request-honda-1',
});
hondaResources = addScopeResource(hondaResources, {
  scopeId: hondaScope.scopeId,
  relation: 'vehicle',
  resourceType: 'vehicle',
  resourceId: 'vehicle-honda-1',
});
hondaResources = addScopeResource(hondaResources, {
  scopeId: hondaScope.scopeId,
  relation: 'vehicle',
  resourceType: 'vehicle',
  resourceId: 'vehicle-honda-1',
});
assert(hondaResources.length === 2, 'Scope resources must dedupe without copying domain objects.');
assert(primaryScopeResource(hondaResources)?.resourceId === 'service-request-honda-1', 'A scope can identify its primary canonical case resource.');

const deliveryLink = buildEcosystemLinkRequest({
  requestId: 'ecosystem-link-delivery-1',
  scope: hondaScope,
  requestedBy: { actorId: 'user-1', actorType: 'user' },
  resource: { resourceType: 'customer_delivery', resourceId: 'delivery-1' },
  relation: 'delivery',
  sourceCore: 'commerce',
  authorizationEvidenceRef: 'commerce-claim-result-1',
  accessMode: 'view_status',
  requestedAt: now,
});
const deliveryResource = scopeResourceFromAuthorizedLink(deliveryLink);
hondaResources = addScopeResource(hondaResources, deliveryResource);
assert(deliveryResource.resourceType === 'customer_delivery', 'Message Core must link Commerce delivery by stable reference.');
assert(deliveryResource.sourceCore === 'commerce', 'Owning/authorizing core must remain explicit.');
assert(deliveryResource.authorizationEvidenceRef === 'commerce-claim-result-1', 'Message Core records only non-secret authorization evidence reference.');

const serializedLink = JSON.stringify(deliveryLink).toLowerCase();
for (const forbidden of ['phonee164', 'email', 'address', 'tokenhash', 'shareurl', 'bearertoken']) {
  assert(!serializedLink.includes(forbidden), `Ecosystem link contract must not copy ${forbidden} into Message Core.`);
}

let id = 0;
const store = new InMemoryMessageStore({
  nextMessageId: () => `message-${++id}`,
  nextOutboxEventId: () => `outbox-${id}`,
});
const scopedMessage = await store.persistMessage({
  conversationId,
  scopeId: hondaScope.scopeId,
  clientMessageId: 'client-message-honda-1',
  sender: { actorId: 'user-1', actorType: 'user' },
  type: 'text',
  body: '¿Cómo va la reparación?',
  createdAt: now,
});
const generalMessage = await store.persistMessage({
  conversationId,
  clientMessageId: 'client-message-general-1',
  sender: { actorId: 'user-1', actorType: 'user' },
  type: 'text',
  body: 'Gracias.',
  createdAt: now,
});
assert(scopedMessage.message.scopeId === hondaScope.scopeId, 'Case-specific messages must preserve their scope.');
assert(generalMessage.message.scopeId === undefined, 'A relationship conversation must still allow unscoped general messages.');
assert(generalMessage.message.sequence === scopedMessage.message.sequence + 1, 'Scopes must not split the durable conversation sequence.');

const action = buildDomainActionRequest({
  requestId: 'action-delivery-1',
  conversationId,
  scopeId: hondaScope.scopeId,
  sourceMessageId: scopedMessage.message.messageId,
  requestedBy: { actorId: 'user-1', actorType: 'user' },
  actionRef: {
    resourceType: 'customer_delivery',
    resourceId: 'delivery-1',
    action: 'open_status',
    contractVersion: 'v1',
  },
  requestedAt: now,
});
assert(action.scopeId === hondaScope.scopeId, 'Domain actions must remain attached to the relevant scope.');
assert(!('phone' in action) && !('email' in action), 'Domain action bridge must not absorb customer contact data.');

console.log('Message scope/ecosystem contract tests passed.');
