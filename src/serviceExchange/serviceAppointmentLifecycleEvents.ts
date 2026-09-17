import type { PaltaEvent } from '../events/eventBusPort.js';
import { buildCanonicalResourceChangeEvent } from '../events/canonicalChangeContract.js';
import { buildCareSignalEvent } from '../care/careSignalContract.js';

const SOURCE_CORE = 'service-appointment';
const RESOURCE_TYPE = 'service_appointment';

export type ServiceAppointmentLifecycleEventPair = readonly [PaltaEvent, PaltaEvent];

function canonical(input: {
  appointmentId: string;
  changeType: string;
  occurredAt: string;
}): PaltaEvent {
  return buildCanonicalResourceChangeEvent({
    eventId: `${input.appointmentId}:${input.changeType}`,
    sourceCore: SOURCE_CORE,
    resourceType: RESOURCE_TYPE,
    resourceId: input.appointmentId,
    changeType: input.changeType,
    occurredAt: input.occurredAt,
    dedupeKey: `service-appointment:${input.appointmentId}:${input.changeType}`,
  });
}

export function buildServiceAppointmentRequestedEvents(input: {
  appointmentId: string;
  occurredAt: string;
  sourceSequence?: number;
}): ServiceAppointmentLifecycleEventPair {
  return [
    canonical({
      appointmentId: input.appointmentId,
      changeType: 'service_appointment.requested',
      occurredAt: input.occurredAt,
    }),
    buildCareSignalEvent({
      eventId: `${input.appointmentId}:requested:care`,
      sourceCore: SOURCE_CORE,
      resourceType: RESOURCE_TYPE,
      resourceId: input.appointmentId,
      careEvent: 'start_action',
      occurredAt: input.occurredAt,
      dedupeKey: `service-appointment:${input.appointmentId}:care:start`,
      ...(input.sourceSequence !== undefined
        ? { sourceSequence: input.sourceSequence }
        : {}),
    }),
  ];
}

export function buildServiceAppointmentConfirmedEvents(input: {
  appointmentId: string;
  scheduledAt: string;
  occurredAt: string;
  sourceSequence?: number;
}): ServiceAppointmentLifecycleEventPair {
  return [
    canonical({
      appointmentId: input.appointmentId,
      changeType: 'service_appointment.confirmed',
      occurredAt: input.occurredAt,
    }),
    buildCareSignalEvent({
      eventId: `${input.appointmentId}:confirmed:care`,
      sourceCore: SOURCE_CORE,
      resourceType: RESOURCE_TYPE,
      resourceId: input.appointmentId,
      careEvent: 'schedule',
      occurredAt: input.occurredAt,
      dedupeKey: `service-appointment:${input.appointmentId}:care:schedule`,
      ...(input.sourceSequence !== undefined
        ? { sourceSequence: input.sourceSequence }
        : {}),
      expectedAt: input.scheduledAt,
    }),
  ];
}

export function buildServiceAppointmentStartedEvents(input: {
  appointmentId: string;
  occurredAt: string;
  sourceSequence?: number;
}): ServiceAppointmentLifecycleEventPair {
  return [
    canonical({
      appointmentId: input.appointmentId,
      changeType: 'service_appointment.started',
      occurredAt: input.occurredAt,
    }),
    buildCareSignalEvent({
      eventId: `${input.appointmentId}:started:care`,
      sourceCore: SOURCE_CORE,
      resourceType: RESOURCE_TYPE,
      resourceId: input.appointmentId,
      careEvent: 'begin',
      occurredAt: input.occurredAt,
      dedupeKey: `service-appointment:${input.appointmentId}:care:begin`,
      ...(input.sourceSequence !== undefined
        ? { sourceSequence: input.sourceSequence }
        : {}),
    }),
  ];
}

export function buildServiceAppointmentCompletedEvents(input: {
  appointmentId: string;
  occurredAt: string;
  sourceSequence?: number;
}): ServiceAppointmentLifecycleEventPair {
  return [
    canonical({
      appointmentId: input.appointmentId,
      changeType: 'service_appointment.completed',
      occurredAt: input.occurredAt,
    }),
    buildCareSignalEvent({
      eventId: `${input.appointmentId}:completed:care`,
      sourceCore: SOURCE_CORE,
      resourceType: RESOURCE_TYPE,
      resourceId: input.appointmentId,
      careEvent: 'complete',
      occurredAt: input.occurredAt,
      dedupeKey: `service-appointment:${input.appointmentId}:care:complete`,
      ...(input.sourceSequence !== undefined
        ? { sourceSequence: input.sourceSequence }
        : {}),
    }),
  ];
}
