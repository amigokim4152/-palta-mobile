import {
  canAutoPublishToChannel,
  canExposeChannelLink,
  resolveContentDistributionMode,
  validateBusinessChannelConnection,
  type BusinessChannelConnection,
} from '../src/business/businessChannelConnection.js';
import {
  rankOwnerPartnerActions,
  shouldSurfaceCommercialUpgrade,
  type OwnerPartnerAction,
} from '../src/business/ownerPartnerActions.js';
import {
  validateOperatorContextProjection,
  validateReviewedOperatorReply,
} from '../src/core/operatorMessagingBridge.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const personalInstagram: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'instagram',
  level: 'assisted_share',
  status: 'active',
  accountKind: 'personal',
  publicUrl: 'https://instagram.com/example',
  capabilities: ['public_link', 'assisted_share'],
};
assert(canExposeChannelLink(personalInstagram), 'A personal social account can still be linked from the free profile.');
assert(!canAutoPublishToChannel(personalInstagram), 'A public/personal social link must never imply API publish authorization.');
assert(resolveContentDistributionMode(personalInstagram) === 'assisted', 'Assisted share should remain a first-class fallback.');
assert(validateBusinessChannelConnection(personalInstagram).length === 0, 'Valid assisted-share connection should pass validation.');

const connectedGoogle: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'google_business',
  level: 'connected_publish',
  status: 'active',
  accountKind: 'business',
  authorizedAt: '2026-09-17T08:00:00-03:00',
  capabilities: ['read_profile', 'publish_content', 'sync_business_facts'],
};
assert(canAutoPublishToChannel(connectedGoogle), 'Explicit provider authorization + publish capability should enable automatic distribution.');

const actions: OwnerPartnerAction[] = [
  {
    id: 'paid-social-automation',
    class: 'optional_automation',
    title: 'Publica una vez en varios canales',
    reason: 'The owner repeats the same post across channels.',
    target: '/business/automation',
    evidenceRefs: ['channel-repeat:7d'],
    actionRequired: false,
    commercial: 'may_be_paid',
  },
  {
    id: 'confirm-hours',
    class: 'stale_or_inaccurate_truth',
    title: 'Confirma tu horario',
    reason: 'Hours have not been reconfirmed recently.',
    target: '/business/hours',
    evidenceRefs: ['hours:last-confirmed'],
    actionRequired: true,
    commercial: 'free',
    urgency: 2,
  },
  {
    id: 'reply-customer',
    class: 'urgent_customer_or_operation',
    title: 'Responde una consulta',
    reason: 'A customer is waiting for a reply.',
    target: '/messages/conv-1',
    evidenceRefs: ['conversation:conv-1'],
    actionRequired: true,
    commercial: 'free',
    urgency: 4,
  },
];
const ranked = rankOwnerPartnerActions(actions);
assert(ranked[0]?.id === 'reply-customer', 'A real customer waiting must outrank profile or commercial advice.');
assert(ranked[1]?.id === 'confirm-hours', 'Stale public truth must outrank a paid automation suggestion.');
assert(!shouldSurfaceCommercialUpgrade(actions, 'paid-social-automation'), 'Commercial upgrade should wait while higher-priority customer/truth work exists.');
assert(rankOwnerPartnerActions([]).length === 0, 'Owner Home may be quiet when nothing needs attention.');

const operatorProjectionIssues = validateOperatorContextProjection({
  conversation: {
    conversationId: 'conv-1',
    displayName: 'Panadería Los Alerces',
    contextType: 'business_owner',
    businessId: 'biz-1',
    lastMessageAt: '2026-09-17T08:20:00-03:00',
    needsOperatorReply: true,
  },
  recentMessages: [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'owner-1',
      senderRole: 'external_user',
      bodyText: 'Hola, tengo una duda sobre el cupón.',
      createdAt: '2026-09-17T08:20:00-03:00',
    },
  ],
  permittedFacts: [{ key: 'business_name', value: 'Panadería Los Alerces', sourceRef: 'business:biz-1' }],
});
assert(operatorProjectionIssues.length === 0, 'Authorized operator context should expose readable text without unrelated private data.');

const reviewIssues = validateReviewedOperatorReply({
  conversationId: 'conv-1',
  bodyText: 'Hola. El cupón básico está disponible para negocios verificados.',
  sourceLanguage: 'ko',
  deliveryLanguage: 'es-CL',
  reviewedByOperatorId: 'operator-1',
  reviewedAt: '2026-09-17T08:30:00-03:00',
});
assert(reviewIssues.length === 0, 'A human-reviewed translated reply should be eligible for the messaging adapter.');

const missingReviewIssues = validateReviewedOperatorReply({
  conversationId: 'conv-1',
  bodyText: 'Respuesta creada por IA',
  sourceLanguage: 'ko',
  deliveryLanguage: 'es-CL',
  reviewedByOperatorId: '',
  reviewedAt: '2026-09-17T08:30:00-03:00',
});
assert(missingReviewIssues.includes('operator_review_required'), 'AI-generated operator replies must not auto-send without human review metadata.');

console.log('PASS: Local Business growth/channel/owner-action/operator messaging contracts');
