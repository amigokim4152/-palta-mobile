import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  api: 'src/api/messagingApiClient.ts',
  conversationHttp: 'src/messaging/conversationHttpContract.ts',
  factory: 'src/api/paltaApiFactory.ts',
  runtime: 'mobile-overlay/src/services/paltaClient.ts',
  marketBootstrap: 'mobile-overlay/src/providers/MarketRuntimeBootstrap.tsx',
  marketFlow: 'src/market/marketMessagingFlow.ts',
  actionBar: 'mobile-overlay/src/components/business/BusinessActionBar.tsx',
  entry: 'mobile-overlay/src/features/messaging/BusinessConversationEntryScreen.tsx',
  conversation: 'mobile-overlay/src/features/messaging/ConversationScreen.tsx',
  entryRoute: 'mobile-overlay/src/app/messages/business/[businessId].tsx',
  conversationRoute: 'mobile-overlay/src/app/messages/[conversationId].tsx',
};

function fail(message) {
  throw new Error(message);
}

function read(name) {
  const relative = files[name];
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) fail(`Missing Shared Messaging runtime file: ${relative}`);
  return fs.readFileSync(target, 'utf8');
}

const api = read('api');
const conversationHttp = read('conversationHttp');
const factory = read('factory');
const runtime = read('runtime');
const marketBootstrap = read('marketBootstrap');
const marketFlow = read('marketFlow');
const actionBar = read('actionBar');
const entry = read('entry');
const conversation = read('conversation');
read('entryRoute');
read('conversationRoute');

for (const endpoint of [
  '/v1/messages/businesses/${requiredPathId(businessId, \'businessId\')}/conversation',
  '/v1/messages/users/${requiredPathId(counterpartUserId, \'counterpartUserId\')}/conversation',
]) {
  if (!conversationHttp.includes(endpoint)) {
    fail(`Message Core conversation HTTP contract lost canonical endpoint: ${endpoint}`);
  }
}
for (const endpoint of [
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/timeline',
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/messages',
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/read',
]) {
  if (!api.includes(endpoint)) fail(`Messaging API client lost canonical endpoint: ${endpoint}`);
}
if (
  !api.includes('conversationHttpContract.openBusinessConversation(businessId)') ||
  !api.includes('conversationHttpContract.openDirectUserConversation(counterpartUserId)')
) {
  fail('Messaging API client must consume the shared business + direct conversation HTTP contract.');
}
if (!api.includes("conversation.conversation_type !== 'direct'")) {
  fail('Direct-user entry must reject a non-direct Message Core response.');
}
if (!api.includes("headers.Authorization = `Bearer ${token}`")) {
  fail('Messaging API client must attach the current authenticated bearer token per request.');
}
if (!api.includes("'Idempotency-Key': input.clientMessageId")) {
  fail('Message sends must preserve client-message idempotency.');
}
if (!factory.includes('messaging: MessagingApiClient') || !factory.includes('client.messaging = new MessagingApiClient')) {
  fail('Shared Messaging must be attached to the canonical Palta API factory, not a Local Business-only client.');
}
if (!runtime.includes('createSupabaseAuthPort') || !runtime.includes('getAuthenticatedMobileRuntime')) {
  fail('Messaging runtime must reuse the singleton mobile AuthPort instead of snapshotting access tokens.');
}
if (
  !actionBar.includes("capability === 'inquiry'") ||
  !actionBar.includes('/messages/business/${encodeURIComponent(businessId)}')
) {
  fail('Negocios Consultar must hand off to the Shared Messaging route.');
}
if (!entry.includes('runtime.client.messaging.openBusinessConversation(businessId)')) {
  fail('Business Messaging entry must ask Shared Messaging Core to create/reuse conversation identity.');
}
if (!entry.includes('Abrir WhatsApp') || !entry.includes('Llamar')) {
  fail('Unavailable internal Messaging must preserve useful external contact fallbacks.');
}
if (
  !marketBootstrap.includes('installMarketRuntime') ||
  !marketBootstrap.includes('createMarketHttpPorts') ||
  !marketBootstrap.includes('runtime.client.messaging.openDirectUserConversation')
) {
  fail('Mercado live runtime must use shared HTTP ports and Shared Message Core direct-user entry.');
}
if (
  !marketFlow.includes('ensurePeerConversation') ||
  !marketFlow.includes("resourceType: 'market_transaction'") ||
  !marketFlow.includes('startTransaction')
) {
  fail('Mercado messaging handoff must converge relationship conversation + market transaction context.');
}
if (
  marketBootstrap.includes('new WebSocket') ||
  marketBootstrap.includes('AsyncStorage') ||
  marketBootstrap.includes('SQLite')
) {
  fail('Mercado messaging bridge must not create a second chat persistence/realtime stack.');
}
if (
  !conversation.includes('listConversationTimeline') ||
  !conversation.includes('advanceMessageRead') ||
  !conversation.includes('sendMessage')
) {
  fail('Conversation screen must use canonical timeline, read-state and send contracts.');
}
if (
  !conversation.includes('contextLabel') ||
  !conversation.includes('contextResourceId') ||
  !conversation.includes('initialText')
) {
  fail('Shared conversation UI must preserve Mercado context and prepared message across navigation.');
}
if (conversation.includes('latitude') || conversation.includes('longitude')) {
  fail('Messaging surface must not inject precise location into ordinary inquiries.');
}
if (conversation.includes('setInterval(') || conversation.includes('WebSocket(')) {
  fail('Do not fake realtime transport before Shared Messaging realtime adapter is composed.');
}

console.log('PASS: Shared Messaging runtime + Negocios + Mercado direct-user handoff');
