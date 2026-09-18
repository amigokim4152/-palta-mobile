import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  api: 'src/api/messagingApiClient.ts',
  factory: 'src/api/paltaApiFactory.ts',
  runtime: 'mobile-overlay/src/services/paltaClient.ts',
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
const factory = read('factory');
const runtime = read('runtime');
const actionBar = read('actionBar');
const entry = read('entry');
const conversation = read('conversation');
read('entryRoute');
read('conversationRoute');

for (const endpoint of [
  '/v1/messages/businesses/${encodeURIComponent(businessId)}/conversation',
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/timeline',
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/messages',
  '/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/read',
]) {
  if (!api.includes(endpoint)) fail(`Messaging API client lost canonical endpoint: ${endpoint}`);
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
  !conversation.includes('listConversationTimeline') ||
  !conversation.includes('advanceMessageRead') ||
  !conversation.includes('sendMessage')
) {
  fail('Conversation screen must use canonical timeline, read-state and send contracts.');
}
if (conversation.includes('latitude') || conversation.includes('longitude')) {
  fail('Messaging surface must not inject precise location into ordinary business inquiries.');
}
if (conversation.includes('setInterval(') || conversation.includes('WebSocket(')) {
  fail('Do not fake realtime transport before Shared Messaging realtime adapter is composed.');
}

console.log('PASS: Shared Messaging mobile runtime + Negocios inquiry handoff');
