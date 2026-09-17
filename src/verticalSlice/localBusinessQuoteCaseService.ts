import type { Conversation } from '../messaging/contracts.js';
import type { ConversationScope } from '../messaging/contracts.js';
import type { CareTrack } from '../care/careMachine.js';

export interface BusinessConversationOpener {
  openUserBusinessConversation(input: {
    principalUserId: string;
    businessId: string;
    createdAt: string;
  }): Promise<{ conversation: Conversation; created: boolean }>;
}

export interface QuoteScopeIntegrator {
  ensureForPrimaryResource(input: {
    conversationId: string;
    scopeType: string;
    label?: string;
    requestedBy: { actorType: 'user'; actorId: string };
    sourceCore: string;
    primaryResource: { resourceType: string; resourceId: string };
    authorizationEvidenceRef: string;
    accessMode: 'participate';
    createdAt: string;
  }): Promise<{ scope: ConversationScope; created: boolean }>;

  attachAuthorizedResource(input: {
    conversationId: string;
    scopeId: string;
    requestedBy: { actorType: 'user'; actorId: string };
    sourceCore: string;
    relation: 'booking';
    resource: { resourceType: string; resourceId: string };
    authorizationEvidenceRef: string;
    accessMode: 'participate';
  }): Promise<unknown>;
}

export interface CareStarter {
  start(input: {
    userId: string;
    intentKey: string;
    mode: 'confirmed_action';
    subjectEntityId?: string;
    clientRequestId: string;
  }): Promise<{ track: CareTrack; created: boolean }>;
}

export interface CareResourceIntegrator {
  link(input: {
    principalUserId: string;
    careTrackId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    relation?: string;
    linkedAt: string;
  }): Promise<{ replayed: boolean }>;
}

export interface LocalBusinessQuoteCase {
  conversationId: string;
  scopeId: string;
  careTrackId: string;
  conversationCreated: boolean;
  scopeCreated: boolean;
  careCreated: boolean;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

/**
 * Cross-core application orchestration for the first local-business vertical
 * slice. Service Exchange must create/authorize the canonical quote_request
 * before this is called. No quote payload or customer PII is copied here.
 *
 * Each dependency is independently idempotent. This is intentionally not one
 * distributed transaction: retrying the same command reuses already-created
 * relationship, scope, Care track and resource links.
 */
export class LocalBusinessQuoteCaseService {
  constructor(
    private readonly conversations: BusinessConversationOpener,
    private readonly scopes: QuoteScopeIntegrator,
    private readonly care: CareStarter,
    private readonly careResources: CareResourceIntegrator,
  ) {}

  async start(input: {
    principalUserId: string;
    businessId: string;
    quoteRequestId: string;
    quoteAuthorizationEvidenceRef: string;
    clientRequestId: string;
    createdAt: string;
    label?: string;
    subjectEntityId?: string;
  }): Promise<LocalBusinessQuoteCase> {
    const principalUserId = required(input.principalUserId, 'principalUserId');
    const businessId = required(input.businessId, 'businessId');
    const quoteRequestId = required(input.quoteRequestId, 'quoteRequestId');
    const quoteAuthorizationEvidenceRef = required(
      input.quoteAuthorizationEvidenceRef,
      'quoteAuthorizationEvidenceRef',
    );
    const clientRequestId = required(input.clientRequestId, 'clientRequestId');
    const createdAt = required(input.createdAt, 'createdAt');

    const conversation = await this.conversations.openUserBusinessConversation({
      principalUserId,
      businessId,
      createdAt,
    });

    const care = await this.care.start({
      userId: principalUserId,
      intentKey: 'local_business_service',
      mode: 'confirmed_action',
      ...(input.subjectEntityId !== undefined
        ? { subjectEntityId: required(input.subjectEntityId, 'subjectEntityId') }
        : {}),
      clientRequestId,
    });

    const scope = await this.scopes.ensureForPrimaryResource({
      conversationId: conversation.conversation.conversationId,
      scopeType: 'service_case',
      ...(input.label !== undefined ? { label: input.label } : {}),
      requestedBy: { actorType: 'user', actorId: principalUserId },
      sourceCore: 'service-exchange',
      primaryResource: {
        resourceType: 'quote_request',
        resourceId: quoteRequestId,
      },
      authorizationEvidenceRef: quoteAuthorizationEvidenceRef,
      accessMode: 'participate',
      createdAt,
    });

    await this.careResources.link({
      principalUserId,
      careTrackId: care.track.id,
      sourceCore: 'service-exchange',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      relation: 'primary',
      linkedAt: createdAt,
    });

    return {
      conversationId: conversation.conversation.conversationId,
      scopeId: scope.scope.scopeId,
      careTrackId: care.track.id,
      conversationCreated: conversation.created,
      scopeCreated: scope.created,
      careCreated: care.created,
    };
  }

  /**
   * Once an appointment exists, link it to the SAME service-case Scope and Care
   * track before appointment lifecycle events are emitted.
   */
  async attachAppointment(input: {
    principalUserId: string;
    conversationId: string;
    scopeId: string;
    careTrackId: string;
    appointmentId: string;
    appointmentAuthorizationEvidenceRef: string;
    linkedAt: string;
  }): Promise<void> {
    const principalUserId = required(input.principalUserId, 'principalUserId');
    const conversationId = required(input.conversationId, 'conversationId');
    const scopeId = required(input.scopeId, 'scopeId');
    const careTrackId = required(input.careTrackId, 'careTrackId');
    const appointmentId = required(input.appointmentId, 'appointmentId');
    const linkedAt = required(input.linkedAt, 'linkedAt');
    const evidence = required(
      input.appointmentAuthorizationEvidenceRef,
      'appointmentAuthorizationEvidenceRef',
    );

    await this.scopes.attachAuthorizedResource({
      conversationId,
      scopeId,
      requestedBy: { actorType: 'user', actorId: principalUserId },
      sourceCore: 'service-appointment',
      relation: 'booking',
      resource: {
        resourceType: 'service_appointment',
        resourceId: appointmentId,
      },
      authorizationEvidenceRef: evidence,
      accessMode: 'participate',
    });

    await this.careResources.link({
      principalUserId,
      careTrackId,
      sourceCore: 'service-appointment',
      resourceType: 'service_appointment',
      resourceId: appointmentId,
      relation: 'booking',
      linkedAt,
    });
  }
}
