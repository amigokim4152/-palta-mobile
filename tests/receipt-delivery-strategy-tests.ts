import {
  buildCustomerInitiatedWhatsAppReceiptPlan,
  buildReceiptDeliveryPlan,
} from '../src/commerce/receiptDeliveryStrategy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const receiptUrl = 'https://somospalta.cl/r/opaque-short-lived-token';

const knownPalta = buildReceiptDeliveryPlan({
  secureReceiptUrl: receiptUrl,
  paltaUserId: 'palta-user-1',
  printingAvailable: true,
});
assert(
  knownPalta.primary.kind === 'palta_inbox' && !knownPalta.requiresContactEntry,
  'Known Palta users should receive the receipt in Palta without contact entry.',
);
assert(
  knownPalta.fallbacks.some((option) => option.kind === 'qr_claim'),
  'Known Palta users should still have QR as a device-independent fallback.',
);

const guest = buildReceiptDeliveryPlan({
  secureReceiptUrl: receiptUrl,
  printingAvailable: false,
});
assert(
  guest.primary.kind === 'qr_claim' && !guest.requiresContactEntry,
  'Guest checkout must default to a phone-free QR receipt claim.',
);
assert(
  !guest.fallbacks.some((option) => option.kind === 'known_whatsapp_handoff'),
  'Palta must not ask for or invent a WhatsApp destination during normal guest checkout.',
);
assert(
  guest.fallbacks.some((option) => option.kind === 'system_share') &&
    !guest.fallbacks.some((option) => option.kind === 'print'),
  'Guest receipt may be shared from the customer device without requiring paper.',
);

const knownPhone = buildReceiptDeliveryPlan({
  secureReceiptUrl: receiptUrl,
  knownCustomerPhoneE164: '+56912345678',
});
const whatsapp = knownPhone.fallbacks.find(
  (option) => option.kind === 'known_whatsapp_handoff',
);
assert(
  whatsapp?.kind === 'known_whatsapp_handoff' && whatsapp.phoneE164 === '+56912345678',
  'Known transactional WhatsApp destination may be offered without retyping the phone.',
);

const customerInitiated = buildCustomerInitiatedWhatsAppReceiptPlan({
  businessPhoneE164: '+56987654321',
  claimRequestCode: 'receipt_claim_AbCdEf0123456789',
});
assert(
  customerInitiated.url.startsWith('https://wa.me/56987654321?text='),
  'Customer-initiated WhatsApp receipt QR must target the Palta/merchant business number.',
);
assert(
  !customerInitiated.url.includes('56912345678'),
  'Customer-initiated WhatsApp flow must not require the customer phone number in the POS QR.',
);

let shortCodeBlocked = false;
try {
  buildCustomerInitiatedWhatsAppReceiptPlan({
    businessPhoneE164: '+56987654321',
    claimRequestCode: 'too-short',
  });
} catch {
  shortCodeBlocked = true;
}
assert(shortCodeBlocked, 'Weak/short WhatsApp receipt claim request codes must fail closed.');

console.log('PASS: phone-free Palta receipt delivery strategy tests');
