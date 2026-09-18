import type { CareTrack } from '../../care/careMachine.js';
import type {
  HomeCorrectionReason,
  HomeDataMode,
  HomeFunctionalItem,
  HomeSubjectRef,
} from '../homeFunctionalContract.js';

export type CareFunctionalInput = {
  track: CareTrack;
  title: string;
  detail?: string;
  sourceDomain: string;
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  needsUserAction?: boolean;
  scheduledAt?: string;
  personalized?: boolean;
  subject?: HomeSubjectRef;
  corrections?: HomeCorrectionReason[];
};

function defaultCorrections(input: CareFunctionalInput): HomeCorrectionReason[] | undefined {
  if (!input.personalized) return input.corrections;
  return input.corrections ?? [
    'not_relevant',
    'wrong_subject',
    'already_done',
    'incorrect_information',
  ];
}

function baseItem(
  input: CareFunctionalInput,
  surface: HomeFunctionalItem['surface'],
  kind: HomeFunctionalItem['kind'],
  title: string,
  body?: string,
): HomeFunctionalItem {
  const item: HomeFunctionalItem = {
    id: `care-home-${input.track.id}`,
    surface,
    kind,
    title,
    source: {
      domain: input.sourceDomain,
      mode: input.dataMode,
      observedAt: input.observedAt,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    },
    action: {
      label: kind === 'status' ? 'Ver seguimiento' : 'Continuar',
      kind: 'internal',
      target: `/care/${encodeURIComponent(input.track.id)}`,
    },
    ...(body ? { body } : {}),
    ...(input.personalized !== undefined ? { personalized: input.personalized } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
  };

  const corrections = defaultCorrections(input);
  if (corrections) item.corrections = corrections;
  return item;
}

function waitingBody(track: CareTrack, detail?: string): string | undefined {
  if (detail) return detail;
  if (track.waitingFor) return `Esperando: ${track.waitingFor}`;
  if (track.expectedAt) return 'Palta seguirá revisando este proceso.';
  return undefined;
}

/**
 * Projects canonical Care state into Home semantics.
 *
 * Important: Care `expectedAt` is process timing, not a confirmed appointment.
 * Only the adapter input `scheduledAt` may create a PRÓXIMO item.
 */
export function careTrackToFunctionalHome(
  input: CareFunctionalInput,
): HomeFunctionalItem | null {
  const { track } = input;

  switch (track.state) {
    case 'cancelled':
    case 'completed':
    case 'outcome_recorded':
      return null;

    case 'discovered':
      if (!input.needsUserAction) return null;
      return baseItem(
        input,
        'now',
        'action',
        `${input.title}: revisa el siguiente paso`,
        input.detail,
      );

    case 'preparing':
      return baseItem(
        input,
        'now',
        'action',
        `${input.title}: falta preparar algo`,
        input.detail ?? 'Revisa lo necesario antes de continuar.',
      );

    case 'action_started':
      return baseItem(
        input,
        input.needsUserAction ? 'now' : 'in_progress',
        input.needsUserAction ? 'action' : 'status',
        input.title,
        input.detail,
      );

    case 'waiting':
      return baseItem(
        input,
        'in_progress',
        'status',
        input.title,
        waitingBody(track, input.detail),
      );

    case 'upcoming': {
      if (!input.scheduledAt) {
        return baseItem(
          input,
          'in_progress',
          'status',
          input.title,
          input.detail ?? 'La fecha todavía no está confirmada.',
        );
      }
      const item = baseItem(
        input,
        'upcoming',
        'status',
        input.title,
        input.detail,
      );
      item.scheduledAt = input.scheduledAt;
      return item;
    }

    case 'in_progress':
      return baseItem(input, 'in_progress', 'status', input.title, input.detail);

    case 'result_available':
      return baseItem(
        input,
        'now',
        'action',
        `${input.title}: hay un resultado`,
        input.detail ?? track.result?.summary ?? 'Revisa el resultado y decide el siguiente paso.',
      );

    case 'follow_up':
      return baseItem(
        input,
        'now',
        'action',
        `${input.title}: seguimiento pendiente`,
        input.detail ?? 'Hay una acción de seguimiento pendiente.',
      );

    case 'blocked':
      return baseItem(
        input,
        'now',
        'alert',
        `${input.title}: necesita atención`,
        input.detail ?? 'El proceso no puede continuar hasta resolver este bloqueo.',
      );
  }
}
