import type { BusinessVerificationStatus } from './businessActionPolicy.js';
import type { BusinessFactField } from './businessFactEvidence.js';
import type { BusinessOperationalState } from './businessOperationalState.js';
import {
  canExposeChannelLink,
  type BusinessChannelConnection,
} from './businessChannelConnection.js';
import type { OwnerPartnerAction } from './ownerPartnerActions.js';

export type OwnerBusinessGuidanceInput = {
  businessId: string;
  verificationStatus: BusinessVerificationStatus;
  operationalState?: BusinessOperationalState;
  hoursConfirmedAt?: string;
  now: string | Date;
  maxHoursConfirmationAgeMs?: number;
  pendingFactCorrectionCount?: number;
  pendingFactCorrectionFields?: readonly BusinessFactField[];
  photoCount: number;
  hasDescription: boolean;
  serviceCount: number;
  hasPublicContact: boolean;
  hasPublicWebPage: boolean;
  hasActiveBasicCoupon: boolean;
  followerCount?: number;
  channels?: readonly BusinessChannelConnection[];
  /**
   * Aggregate operational evidence only. This should count repeated owner work,
   * not inspect private unrelated content.
   */
  repeatedCrossChannelPublishingCount7d?: number;
  hasCrossChannelAutomation?: boolean;
  searchAliasOpportunities?: readonly {
    alias: string;
    evidenceRef: string;
    ownerConfirmedServiceMatch: boolean;
  }[];
};

function toMs(value: string | Date): number {
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('Invalid owner guidance time');
  return result;
}

function needsHoursReconfirmation(input: OwnerBusinessGuidanceInput): boolean {
  if (input.operationalState === 'permanently_closed') return false;
  if (input.maxHoursConfirmationAgeMs === undefined) return false;
  if (!input.hoursConfirmedAt) return true;
  const confirmedAt = Date.parse(input.hoursConfirmedAt);
  if (!Number.isFinite(confirmedAt)) return true;
  return toMs(input.now) - confirmedAt > input.maxHoursConfirmationAgeMs;
}

/**
 * Deterministic, cheap baseline guidance. AI can later improve wording or handle
 * ambiguous cases, but ordinary profile-care suggestions should not require an
 * LLM call on every owner-home view.
 */
export function buildOwnerBusinessGuidance(
  input: OwnerBusinessGuidanceInput,
): OwnerPartnerAction[] {
  const actions: OwnerPartnerAction[] = [];

  const pendingCorrections = Math.max(0, input.pendingFactCorrectionCount ?? 0);
  if (pendingCorrections > 0 && input.verificationStatus !== 'unverified') {
    const fields = [...new Set(input.pendingFactCorrectionFields ?? [])];
    actions.push({
      id: `${input.businessId}:review-fact-corrections`,
      class: 'stale_or_inaccurate_truth',
      title: pendingCorrections === 1
        ? 'Revisa una corrección de tu perfil'
        : `Revisa ${pendingCorrections} correcciones de tu perfil`,
      reason: fields.length
        ? `Alguien señaló posible información desactualizada en: ${fields.join(', ')}. La sugerencia no cambia tu perfil hasta que se revise.`
        : 'Hay sugerencias de corrección pendientes. Ninguna cambia tu perfil automáticamente.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/corrections`,
      evidenceRefs: [
        `business:${input.businessId}:pending-corrections:${pendingCorrections}`,
        ...fields.map((field) => `business:${input.businessId}:correction-field:${field}`),
      ],
      actionRequired: true,
      commercial: 'free',
      urgency: 3,
    });
  }

  if (needsHoursReconfirmation(input)) {
    actions.push({
      id: `${input.businessId}:confirm-hours`,
      class: 'stale_or_inaccurate_truth',
      title: 'Confirma tu horario',
      reason: 'Tu horario necesita una confirmación reciente para que Palta no muestre información desactualizada.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/hours`,
      evidenceRefs: [`business:${input.businessId}:hours`],
      actionRequired: true,
      commercial: 'free',
      urgency: 2,
    });
  }

  if (input.photoCount === 0) {
    actions.push({
      id: `${input.businessId}:add-photo`,
      class: 'free_practical_improvement',
      title: 'Agrega una foto que explique tu negocio',
      reason: 'Una imagen real ayuda a que una persona entienda más rápido qué encontrará aquí.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/photos`,
      evidenceRefs: [`business:${input.businessId}:photo-count:0`],
      actionRequired: false,
      commercial: 'free',
    });
  }

  if (!input.hasDescription || input.serviceCount === 0) {
    actions.push({
      id: `${input.businessId}:explain-services`,
      class: 'free_practical_improvement',
      title: 'Cuenta claramente qué haces o vendes',
      reason: 'Una descripción y servicios concretos mejoran la comprensión del cliente y la coincidencia con búsquedas reales.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/services`,
      evidenceRefs: [
        `business:${input.businessId}:description:${input.hasDescription ? 'yes' : 'no'}`,
        `business:${input.businessId}:service-count:${input.serviceCount}`,
      ],
      actionRequired: false,
      commercial: 'free',
    });
  }

  if (!input.hasPublicContact) {
    actions.push({
      id: `${input.businessId}:add-contact`,
      class: 'free_practical_improvement',
      title: 'Agrega una forma simple de contacto',
      reason: 'Si una persona entiende tu negocio pero no puede contactarte, la visita al perfil se pierde.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/contact`,
      evidenceRefs: [`business:${input.businessId}:contact:none`],
      actionRequired: false,
      commercial: 'free',
    });
  }

  if (input.hasPublicWebPage) {
    actions.push({
      id: `${input.businessId}:create-qr`,
      class: 'free_practical_improvement',
      title: 'Crea tu QR de Palta',
      reason: 'Ponlo en el mesón, empaque o boleta para que tus clientes vuelvan a encontrar horario, novedades y beneficios sin buscar de nuevo.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/qr`,
      evidenceRefs: [`business:${input.businessId}:public-page`],
      actionRequired: false,
      commercial: 'free',
    });
  }

  if (
    input.verificationStatus === 'verified' &&
    !input.hasActiveBasicCoupon
  ) {
    actions.push({
      id: `${input.businessId}:basic-coupon`,
      class: 'free_practical_improvement',
      title: 'Prueba un beneficio simple para tus clientes',
      reason: 'El cupón básico está disponible para negocios verificados y puede dar una razón concreta para volver o probar tu negocio.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/coupons`,
      evidenceRefs: [`business:${input.businessId}:verified`, `business:${input.businessId}:coupon:none`],
      actionRequired: false,
      commercial: 'free',
    });
  }

  const publicExternalChannels = (input.channels ?? []).filter(
    (channel) => channel.provider !== 'palta' && canExposeChannelLink(channel),
  );
  if (publicExternalChannels.length === 0) {
    actions.push({
      id: `${input.businessId}:connect-channel`,
      class: 'free_practical_improvement',
      title: 'Agrega los enlaces que ya usas',
      reason: 'Puedes mostrar Instagram, Facebook, TikTok, Google, WhatsApp o tu sitio para que el cliente llegue con un toque. Solo guardamos el enlace público; no necesitas conectar una API.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/channels`,
      evidenceRefs: [`business:${input.businessId}:public-channel-link:none`],
      actionRequired: false,
      commercial: 'free',
    });
  }

  const repeatedPublishing = input.repeatedCrossChannelPublishingCount7d ?? 0;
  if (
    publicExternalChannels.length >= 2 &&
    repeatedPublishing >= 2 &&
    !input.hasCrossChannelAutomation
  ) {
    actions.push({
      id: `${input.businessId}:cross-channel-automation`,
      class: 'optional_automation',
      title: 'Publica una vez en varios canales',
      reason: 'Estás repitiendo trabajo entre varios canales. Si te sirve, Palta puede automatizar esa tarea cuando el canal sea compatible y esté autorizado.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/automation`,
      evidenceRefs: [
        `business:${input.businessId}:public-channel-count:${publicExternalChannels.length}`,
        `business:${input.businessId}:cross-channel-publishing-7d:${repeatedPublishing}`,
      ],
      actionRequired: false,
      commercial: 'may_be_paid',
    });
  }

  for (const opportunity of input.searchAliasOpportunities ?? []) {
    if (!opportunity.ownerConfirmedServiceMatch) continue;
    actions.push({
      id: `${input.businessId}:search-alias:${opportunity.alias}`,
      class: 'free_practical_improvement',
      title: `Tus clientes también buscan “${opportunity.alias}”`,
      reason: 'Si esta palabra describe realmente un servicio que ofreces, agregarla ayuda a que Palta entienda mejor cuándo mostrar tu negocio.',
      target: `/business/manage/${encodeURIComponent(input.businessId)}/services`,
      evidenceRefs: [opportunity.evidenceRef],
      actionRequired: false,
      commercial: 'free',
    });
  }

  return actions;
}
