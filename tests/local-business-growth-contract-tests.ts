import {
  canAutoPublishToChannel,
  canExposeChannelLink,
  canUseChannelLevel,
  entitlementRequiredForChannelLevel,
  normalizeOwnerPublicChannelInput,
  normalizeSafePublicChannelUrl,
  projectPublicBusinessChannelLinks,
  resolveContentDistributionMode,
  validateBusinessChannelConnection,
  type BusinessChannelConnection,
  type BusinessChannelEntitlementSnapshot,
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

const freeChannelAccess: BusinessChannelEntitlementSnapshot = { grants: [] };
const paidSocialAccess: BusinessChannelEntitlementSnapshot = {
  grants: [
    'external_channel_assisted_share',
    'external_channel_connected_read',
    'external_channel_connected_publish',
  ],
};

assert(
  entitlementRequiredForChannelLevel('link_only') === null,
  'Public link-only presence must not require a paid entitlement.',
);
assert(
  entitlementRequiredForChannelLevel('connected_publish') ===
    'external_channel_connected_publish',
  'External publishing must require an explicit entitlement grant.',
);
assert(
  normalizeSafePublicChannelUrl(' https://instagram.com/example ') ===
    'https://instagram.com/example',
  'Free public links should be normalized before projection.',
);
assert(
  normalizeSafePublicChannelUrl('javascript:alert(1)') === null,
  'Executable URL schemes must never project from an owner-controlled public link.',
);
assert(
  normalizeSafePublicChannelUrl('data:text/html,hello') === null,
  'Data URLs must never project from an owner-controlled public link.',
);
assert(
  normalizeOwnerPublicChannelInput('instagram', '@cafe.palta') ===
    'https://www.instagram.com/cafe.palta/',
  'Instagram handles should become a safe public URL without requiring the owner to copy the full address.',
);
assert(
  normalizeOwnerPublicChannelInput('whatsapp', '9 1234 5678') ===
    'https://wa.me/56912345678',
  'A Chilean mobile number should become a WhatsApp public link deterministically.',
);
assert(
  normalizeOwnerPublicChannelInput('website', 'mitienda.cl') ===
    'https://mitienda.cl/',
  'A bare website domain should become an https public link.',
);

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
assert(
  !canUseChannelLevel(personalInstagram, freeChannelAccess, 'assisted_share'),
  'Free Business Profile must not silently unlock assisted social distribution.',
);
assert(
  resolveContentDistributionMode(personalInstagram, freeChannelAccess) === 'link_only',
  'Without entitlement, a social account must resolve to its safe free public link.',
);
assert(
  resolveContentDistributionMode(personalInstagram, paidSocialAccess) === 'assisted',
  'With entitlement, assisted distribution can become available when technically supported.',
);
assert(validateBusinessChannelConnection(personalInstagram).length === 0, 'Valid assisted-share connection should pass validation.');

const publicTikTok: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'tiktok',
  level: 'link_only',
  status: 'active',
  accountKind: 'personal',
  publicUrl: 'https://www.tiktok.com/@example',
  capabilities: ['public_link'],
};
const restrictedFacebook: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'facebook',
  level: 'link_only',
  status: 'restricted',
  publicUrl: 'https://facebook.com/example',
  capabilities: ['public_link'],
};
const unsafeWebsite: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'website',
  level: 'link_only',
  status: 'active',
  publicUrl: 'javascript:alert(1)',
  capabilities: ['public_link'],
};
const publicLinks = projectPublicBusinessChannelLinks([
  personalInstagram,
  publicTikTok,
  restrictedFacebook,
  unsafeWebsite,
]);
assert(publicLinks.length === 2, 'Only safe public external links should project to the free Business page.');
assert(publicLinks.some((link) => link.label === 'TikTok'), 'TikTok should work as a first-class link-only channel.');
assert(!publicLinks.some((link) => link.provider === 'facebook'), 'Restricted channels must not leak into the public profile.');
assert(!publicLinks.some((link) => link.provider === 'website'), 'Unsafe owner-controlled URLs must not leak into the public profile.');
assert(
  validateBusinessChannelConnection(unsafeWebsite).includes('public_url_must_be_safe_http_url'),
  'Unsafe public URLs should fail connection validation.',
);

const connectedGoogle: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'google_business',
  level: 'connected_publish',
  status: 'active',
  accountKind: 'business',
  publicUrl: 'https://www.google.com/maps?cid=123',
  authorizedAt: '2026-09-17T08:00:00-03:00',
  capabilities: ['public_link', 'read_profile', 'publish_content', 'sync_business_facts'],
};
assert(
  !canAutoPublishToChannel(connectedGoogle, freeChannelAccess),
  'OAuth/provider readiness alone must never unlock paid automatic publishing.',
);
assert(
  canAutoPublishToChannel(connectedGoogle, paidSocialAccess),
  'Provider authorization plus explicit entitlement should enable automatic distribution.',
);
assert(
  resolveContentDistributionMode(connectedGoogle, freeChannelAccess) === 'link_only',
  'When paid access ends, the Google public link should remain while automation stops.',
);
assert(
  projectPublicBusinessChannelLinks([connectedGoogle]).length === 1,
  'Paid cancellation must not remove an otherwise valid public channel link.',
);

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
