import type {
  CustomerDeliveryAdapterResult,
  CustomerDeliveryPayload,
  CustomerDeliveryPort,
} from '../../ports/customerDeliveryPort.js';

export type WhatsAppHandoffPlan = {
  url: string;
  deliveryId: string;
};

function digitsOnlyE164(phoneE164: string): string {
  const value = phoneE164.trim();
  if (!/^\+[1-9][0-9]{7,14}$/.test(value)) {
    throw new Error('WhatsApp handoff requires a valid E.164 phone number.');
  }
  return value.slice(1);
}

export function buildWhatsAppHandoffPlan(payload: CustomerDeliveryPayload): WhatsAppHandoffPlan {
  if (payload.channel !== 'whatsapp_handoff') {
    throw new Error('WhatsApp handoff adapter received a different delivery channel.');
  }
  const phone = payload.destination.phoneE164;
  if (!phone) throw new Error('WhatsApp handoff requires phoneE164.');
  const digits = digitsOnlyE164(phone);

  const messageParts = [payload.message?.trim(), payload.secureLink?.trim()]
    .filter((value): value is string => Boolean(value));
  if (messageParts.length === 0) {
    throw new Error('WhatsApp handoff requires a message or secure link.');
  }

  const text = encodeURIComponent(messageParts.join('\n'));
  return {
    deliveryId: payload.deliveryId,
    url: `https://wa.me/${digits}?text=${text}`,
  };
}

/**
 * This adapter only prepares a user-controlled handoff. The UI/native shell is
 * responsible for opening the URL. Therefore its truthful outcome is
 * `handed_off`, never `sent` or `delivered`.
 */
export class WhatsAppHandoffPort implements CustomerDeliveryPort {
  readonly channel = 'whatsapp_handoff' as const;

  constructor(
    private readonly openUrl: (url: string) => Promise<void> | void,
  ) {}

  async deliver(payload: CustomerDeliveryPayload): Promise<CustomerDeliveryAdapterResult> {
    const plan = buildWhatsAppHandoffPlan(payload);
    await this.openUrl(plan.url);
    return { outcome: 'handed_off' };
  }
}
