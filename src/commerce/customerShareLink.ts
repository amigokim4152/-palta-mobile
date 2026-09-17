export type CustomerShareLinkScope =
  | 'view_receipt'
  | 'view_fiscal_document'
  | 'view_order_status'
  | 'view_pickup_code'
  | 'view_quote'
  | 'view_service_summary';

export type CustomerShareLink = {
  id: string;
  businessId: string;
  artifactId: string;
  tokenHash: string;
  scope: CustomerShareLinkScope;
  createdAt: string;
  expiresAt: string;
  maxUses?: number;
  useCount: number;
  revokedAt?: string;
};

export function createCustomerShareLink(input: {
  id: string;
  businessId: string;
  artifactId: string;
  tokenHash: string;
  scope: CustomerShareLinkScope;
  createdAt: string;
  expiresAt: string;
  maxUses?: number;
}): CustomerShareLink {
  if (!input.id.trim() || !input.businessId.trim() || !input.artifactId.trim()) {
    throw new Error('Share link id, businessId and artifactId are required.');
  }
  if (!/^[a-f0-9]{64}$/i.test(input.tokenHash)) {
    throw new Error('Share token must be stored as a SHA-256 hash, not plaintext.');
  }
  if (new Date(input.expiresAt).getTime() <= new Date(input.createdAt).getTime()) {
    throw new Error('Share link expiration must be after creation.');
  }
  if (input.maxUses !== undefined && (!Number.isSafeInteger(input.maxUses) || input.maxUses < 1)) {
    throw new Error('maxUses must be a positive safe integer.');
  }

  const link: CustomerShareLink = {
    id: input.id,
    businessId: input.businessId,
    artifactId: input.artifactId,
    tokenHash: input.tokenHash.toLowerCase(),
    scope: input.scope,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    useCount: 0,
  };
  if (input.maxUses !== undefined) link.maxUses = input.maxUses;
  return link;
}

export function canUseCustomerShareLink(link: CustomerShareLink, now: string): boolean {
  if (link.revokedAt !== undefined) return false;
  if (new Date(now).getTime() >= new Date(link.expiresAt).getTime()) return false;
  if (link.maxUses !== undefined && link.useCount >= link.maxUses) return false;
  return true;
}

export function recordCustomerShareLinkUse(link: CustomerShareLink, now: string): CustomerShareLink {
  if (!canUseCustomerShareLink(link, now)) throw new Error('Customer share link is expired, revoked or exhausted.');
  return { ...link, useCount: link.useCount + 1 };
}

export function revokeCustomerShareLink(link: CustomerShareLink, revokedAt: string): CustomerShareLink {
  if (link.revokedAt !== undefined) return link;
  return { ...link, revokedAt };
}

export type CustomerShareMessage = {
  title: string;
  body: string;
  url: string;
};

/**
 * Client adapters may turn this safe message into WhatsApp click-to-chat,
 * native share-sheet, SMS or email. The URL must point to Palta's short-lived
 * share resolver rather than directly to object storage or fiscal XML/PDF.
 */
export function buildCustomerShareMessage(input: {
  title: string;
  body: string;
  publicShareUrl: string;
}): CustomerShareMessage {
  if (!input.title.trim() || !input.body.trim()) throw new Error('Share title and body are required.');
  let parsed: URL;
  try {
    parsed = new URL(input.publicShareUrl);
  } catch {
    throw new Error('publicShareUrl must be an absolute HTTPS URL.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Customer share URL must use HTTPS.');
  if (parsed.username || parsed.password) throw new Error('Customer share URL must not contain credentials.');
  return { title: input.title, body: input.body, url: parsed.toString() };
}
