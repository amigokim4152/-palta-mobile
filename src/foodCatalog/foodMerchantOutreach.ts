import type { FoodOutletIdentity, FoodSourceEvidence } from './foodCatalogModel.js';
import { canPromoteOutletIdentity } from './foodDataGovernance.js';

export type FoodMerchantOutreachStatus =
  | 'not_ready'
  | 'ready_for_identity_confirmation'
  | 'ready_to_contact'
  | 'contacted'
  | 'authorized'
  | 'declined'
  | 'no_response'
  | 'needs_followup';

export type FoodMerchantAuthorizationScope =
  | 'business_identity'
  | 'outlet_address'
  | 'public_contact'
  | 'opening_hours'
  | 'menu_item_names'
  | 'menu_prices'
  | 'delivery_pickup_facts';

/**
 * Images are intentionally excluded from the default authorization scope.
 * Palta food-data collection currently stores factual business/menu data only.
 * Asset/media permission must be handled separately if added later.
 */
export const DEFAULT_FOOD_MERCHANT_AUTHORIZATION_SCOPE: readonly FoodMerchantAuthorizationScope[] = [
  'business_identity',
  'outlet_address',
  'public_contact',
  'opening_hours',
  'menu_item_names',
  'menu_prices',
  'delivery_pickup_facts',
];

export type FoodMerchantOutreachCandidate = Readonly<{
  outletKey: string;
  brandName: string;
  outletName?: string;
  comuna?: string;
  address?: string;
  whatsapp?: string;
  phone?: string;
  website?: string;
  status: FoodMerchantOutreachStatus;
  requestedScope: readonly FoodMerchantAuthorizationScope[];
  sourceEvidence: readonly FoodSourceEvidence[];
}>;

export type FoodMerchantAuthorization = Readonly<{
  outletKey: string;
  status: 'authorized' | 'declined';
  channel: 'whatsapp' | 'phone' | 'email' | 'in_person' | 'palta_merchant';
  authorizedAt: string;
  scope: readonly FoodMerchantAuthorizationScope[];
  evidenceRef: string;
  actorLabel?: string;
}>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiresIdentityConfirmation(outlet: FoodOutletIdentity): boolean {
  return outlet.identityStatus === 'needs_review' || outlet.identityStatus === 'possible_virtual_brand';
}

export function buildFoodMerchantOutreachCandidate(
  outlet: FoodOutletIdentity,
): FoodMerchantOutreachCandidate {
  const whatsapp = clean(outlet.publicContact?.whatsapp);
  const phone = clean(outlet.publicContact?.phone);
  const website = clean(outlet.publicContact?.website);
  const hasReachableContact = Boolean(whatsapp || phone || website);
  const status: FoodMerchantOutreachStatus = !hasReachableContact
    ? 'not_ready'
    : requiresIdentityConfirmation(outlet)
      ? 'ready_for_identity_confirmation'
      : 'ready_to_contact';

  return {
    outletKey: outlet.outletKey,
    brandName: outlet.brandName,
    ...(outlet.outletName ? { outletName: outlet.outletName } : {}),
    ...(outlet.comuna ? { comuna: outlet.comuna } : {}),
    ...(outlet.address ? { address: outlet.address } : {}),
    ...(whatsapp ? { whatsapp } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    status,
    requestedScope: DEFAULT_FOOD_MERCHANT_AUTHORIZATION_SCOPE,
    sourceEvidence: outlet.evidence,
  };
}

export function merchantAuthorizationMayPromoteOutlet(
  outlet: FoodOutletIdentity,
  authorization: FoodMerchantAuthorization | undefined,
): boolean {
  if (!authorization || authorization.status !== 'authorized') return false;
  if (authorization.outletKey !== outlet.outletKey) return false;
  return authorization.scope.includes('business_identity') &&
    authorization.scope.includes('outlet_address');
}

export function outreachNeedsMerchantAuthorization(outlet: FoodOutletIdentity): boolean {
  return !canPromoteOutletIdentity(outlet);
}

/**
 * This template is deliberately short. The actual send action belongs to the
 * shared Messaging/WhatsApp integration, not the food catalog domain.
 */
export function buildSpanishFoodMerchantPermissionMessage(input: {
  brandName: string;
  outletName?: string;
}): string {
  const name = input.outletName ? `${input.brandName} - ${input.outletName}` : input.brandName;
  return [
    `Hola, somos Somos Palta. Estamos preparando la ficha de ${name} en Palta para ayudar a personas cercanas a encontrar el local y consultar información útil.`,
    '¿Nos autorizan a publicar y mantener en Palta los datos públicos del negocio: nombre, dirección, teléfono/WhatsApp, horario, nombres de productos del menú, precios y opciones de retiro/delivery?',
    'No utilizaremos fotos de otras plataformas. Más adelante ustedes podrán revisar y actualizar directamente su ficha.',
    'Si están de acuerdo, basta responder “Sí, autorizo”. Gracias.',
  ].join('\n\n');
}

/**
 * Use this before the authorization request when public sources conflict about
 * the physical outlet. It asks the merchant to resolve the fact first instead
 * of presenting an uncertain address as already established.
 */
export function buildSpanishFoodIdentityConfirmationMessage(input: {
  brandName: string;
  question: string;
}): string {
  return [
    `Hola, somos Somos Palta. Estamos verificando los datos públicos de ${input.brandName} antes de preparar su ficha.`,
    input.question,
    '¿Nos pueden confirmar cuál es el dato correcto? No estamos recopilando fotos; solo queremos dejar correctos los datos del local.',
    'Gracias.',
  ].join('\n\n');
}
