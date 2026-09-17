import { MessageNotificationAudienceService } from '../src/notifications/messageNotificationAudience.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const service = new MessageNotificationAudienceService(
  {
    async load(input) {
      if (input.messageId === 'message-from-user') {
        return {
          sender: { actorType: 'user', actorId: 'customer-1' },
          participants: [
            { actor: { actorType: 'user', actorId: 'customer-1' }, muted: false },
            { actor: { actorType: 'business', actorId: 'business-1' }, muted: false },
          ],
        };
      }
      if (input.messageId === 'message-from-business') {
        return {
          sender: {
            actorType: 'business',
            actorId: 'business-1',
            principalUserId: 'staff-1',
          },
          participants: [
            { actor: { actorType: 'user', actorId: 'customer-1' }, muted: false },
            { actor: { actorType: 'business', actorId: 'business-1' }, muted: false },
          ],
        };
      }
      if (input.messageId === 'muted-business') {
        return {
          sender: { actorType: 'user', actorId: 'customer-1' },
          participants: [
            { actor: { actorType: 'user', actorId: 'customer-1' }, muted: false },
            { actor: { actorType: 'business', actorId: 'business-1' }, muted: true },
          ],
        };
      }
      return null;
    },
  },
  {
    async listActiveStaff(input) {
      assert(input.businessId === 'business-1', 'Business audience lookup must preserve business actor identity.');
      return [
        { principalUserId: 'owner-1', role: 'owner' },
        { principalUserId: 'staff-1', role: 'staff' },
        { principalUserId: 'kitchen-1', role: 'kitchen' },
        { principalUserId: 'viewer-1', role: 'viewer' },
        { principalUserId: 'staff-1', role: 'staff' },
      ];
    },
  },
);

const toBusiness = await service.resolveRecipients({
  conversationId: 'conv-1',
  messageId: 'message-from-user',
});
const businessRecipients = toBusiness.map((item) => item.recipientUserId).sort();
assert(
  JSON.stringify(businessRecipients) === JSON.stringify(['owner-1', 'staff-1']),
  'Business notification audience must include only active roles with customer_message_read and dedupe principals.',
);

const toCustomer = await service.resolveRecipients({
  conversationId: 'conv-1',
  messageId: 'message-from-business',
});
assert(
  toCustomer.length === 1 && toCustomer[0]?.recipientUserId === 'customer-1',
  'Business reply notification must target the customer actor and not business staff themselves.',
);

const muted = await service.resolveRecipients({
  conversationId: 'conv-1',
  messageId: 'muted-business',
});
assert(muted.length === 0, 'Muted relationship actor must not expand into notification principals.');

const missing = await service.resolveRecipients({
  conversationId: 'conv-1',
  messageId: 'missing',
});
assert(missing.length === 0, 'Missing canonical message context must produce no notification recipients.');

console.log('Message notification audience tests passed.');
