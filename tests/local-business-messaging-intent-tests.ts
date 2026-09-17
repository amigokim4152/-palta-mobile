import {
  buildBusinessMessagingConversationSeed,
  validateBusinessMessagingStart,
} from '../src/business/businessMessagingIntent.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const general = buildBusinessMessagingConversationSeed({
  businessId: 'biz-1',
  businessName: 'Panadería Los Alerces',
  intent: 'general_inquiry',
  initialText: '¿Tienen pan sin gluten?',
});
assert(general.contextType === 'business_customer', 'general inquiry should use business_customer context');
assert(general.businessId === 'biz-1', 'business id should be preserved');
assert(general.sourceSurface === 'local_business_profile', 'source surface should identify Local Business');

const quote = buildBusinessMessagingConversationSeed({
  businessId: 'biz-1',
  businessName: 'Panadería Los Alerces',
  intent: 'quote_followup',
  relatedEntityId: 'quote-9',
});
assert(quote.contextType === 'quote', 'quote follow-up should map to quote context');
assert(quote.relatedEntityId === 'quote-9', 'related workflow id should be preserved');

const booking = buildBusinessMessagingConversationSeed({
  businessId: 'biz-2',
  businessName: 'Peluquería Norte',
  intent: 'reservation_question',
});
assert(booking.contextType === 'booking', 'reservation question should map to booking context');

const order = buildBusinessMessagingConversationSeed({
  businessId: 'biz-3',
  businessName: 'Café Sur',
  intent: 'order_question',
});
assert(order.contextType === 'order', 'order question should map to order context');

assert(
  validateBusinessMessagingStart({
    businessId: '',
    businessName: 'Café Sur',
    intent: 'general_inquiry',
  }).includes('business_id_required'),
  'business id should be required',
);
assert(
  validateBusinessMessagingStart({
    businessId: 'biz-3',
    businessName: 'Café Sur',
    intent: 'general_inquiry',
    initialText: '   ',
  }).includes('initial_text_must_not_be_blank'),
  'blank initial message should be rejected when supplied',
);

console.log('PASS: Local Business Shared Messaging entry contract');
