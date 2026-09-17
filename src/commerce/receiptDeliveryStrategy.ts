export type ReceiptPrimaryDelivery =
  | {
      kind: 'palta_inbox';
      paltaUserId: string;
      secureReceiptUrl: string;
    }
  | {
      kind: 'qr_claim';
      secureReceiptUrl: string;
    };

export type ReceiptFallbackOption =
  | { kind: 'qr_claim'; secureReceiptUrl: string }
  | { kind: 'system_share'; secureReceiptUrl: string }
  | { kind: 'known_whatsapp_handoff'; phoneE164: string; secureReceiptUrl: string }
  | { kind: 'manual_contact_entry' }
  | { kind: 'print' };

export type ReceiptDeliveryPlan = {
  primary: ReceiptPrimaryDelivery;
  fallbacks: ReceiptFallbackOption[];
  /** Normal checkout must not pause for phone/email entry. */
  requiresContactEntry: false;
};

function assertSecureReceiptUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Receipt claim URL must be an absolute HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Receipt claim URL must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Receipt claim URL must not contain embedded credentials.');
  }
  return parsed.toString();
}

function assertE164(value: string): string {
  const normalized = value.trim();
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
    throw new Error('Receipt WhatsApp phone must be valid E.164.');
  }
  return normalized;
}

/**
 * Receipt UX policy:
 * - Known Palta user: save to Palta Inbox first.
 * - Guest/unknown customer: show a short-lived Palta receipt QR first.
 * - Never force the cashier/customer to type a phone or email to finish checkout.
 * - WhatsApp handoff is offered only when Palta already has the destination for
 *   this transaction. Manual contact entry remains an explicit fallback.
 * - Printing is optional and never owns the sale/payment/fiscal result.
 */
export function buildReceiptDeliveryPlan(input: {
  secureReceiptUrl: string;
  paltaUserId?: string;
  knownCustomerPhoneE164?: string;
  printingAvailable?: boolean;
}): ReceiptDeliveryPlan {
  const secureReceiptUrl = assertSecureReceiptUrl(input.secureReceiptUrl);
  const paltaUserId = input.paltaUserId?.trim();

  const primary: ReceiptPrimaryDelivery = paltaUserId
    ? { kind: 'palta_inbox', paltaUserId, secureReceiptUrl }
    : { kind: 'qr_claim', secureReceiptUrl };

  const fallbacks: ReceiptFallbackOption[] = [];
  if (paltaUserId) {
    fallbacks.push({ kind: 'qr_claim', secureReceiptUrl });
  }
  fallbacks.push({ kind: 'system_share', secureReceiptUrl });

  if (input.knownCustomerPhoneE164 !== undefined) {
    fallbacks.push({
      kind: 'known_whatsapp_handoff',
      phoneE164: assertE164(input.knownCustomerPhoneE164),
      secureReceiptUrl,
    });
  }

  // Contact entry is intentionally late in the flow. A guest should normally
  // finish by QR/system share without giving Palta or the merchant personal data.
  fallbacks.push({ kind: 'manual_contact_entry' });
  if (input.printingAvailable ?? true) fallbacks.push({ kind: 'print' });

  return {
    primary,
    fallbacks,
    requiresContactEntry: false,
  };
}

export type CustomerInitiatedWhatsAppReceiptPlan = {
  /** Customer scans/opens this URL; the recipient is Palta/merchant, not customer. */
  url: string;
  claimRequestCode: string;
};

/**
 * Optional no-typing WhatsApp path.
 *
 * The POS may render this URL as a QR. The CUSTOMER scans it and initiates the
 * WhatsApp conversation to a Palta/merchant business number, so the cashier does
 * not need the customer's phone number. `claimRequestCode` must be generated as a
 * short-lived, one-time opaque code and stored only as a hash by the server. It
 * correlates the inbound message to a receipt request; it must not be a permanent
 * customer identifier.
 *
 * A WhatsApp Business inbound worker can then respond with the normal Palta
 * short-lived receipt share link inside the customer-initiated service window.
 */
export function buildCustomerInitiatedWhatsAppReceiptPlan(input: {
  businessPhoneE164: string;
  claimRequestCode: string;
  prefix?: string;
}): CustomerInitiatedWhatsAppReceiptPlan {
  const phone = assertE164(input.businessPhoneE164).slice(1);
  const code = input.claimRequestCode.trim();
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(code)) {
    throw new Error('WhatsApp receipt claim request code must be a 20-128 character opaque token.');
  }
  const prefix = input.prefix?.trim() || 'PALTA RECIBO';
  const text = encodeURIComponent(`${prefix} ${code}`);
  return {
    url: `https://wa.me/${phone}?text=${text}`,
    claimRequestCode: code,
  };
}
