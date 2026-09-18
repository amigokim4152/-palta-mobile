import type { CareApiTrack, HomeApiItem } from '../../api/paltaApiClient.js';
import type { HomeDataMode } from '../homeRuntimeContract.js';
import type { HomeSourceContribution, HomeSourceDomain } from '../homeSourceContract.js';

export type CareHomeInput = {
  track: CareApiTrack;
  title: string;
  detail?: string;
  sourceDomain?: HomeSourceDomain;
  dataMode?: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  needsUserAction?: boolean;
};

function waitingDetail(track: CareApiTrack, detail?: string): string | undefined {
  if (detail) return detail;
  if (track.waiting_for) return `Esperando: ${track.waiting_for}`;
  if (track.expected_at) return 'Palta seguirá revisando este proceso.';
  return undefined;
}

/**
 * Project a Care track into Home without confusing expected response time with
 * a scheduled appointment. `expected_at` remains EN CURSO context; actual
 * appointments/deadlines use scheduledEventsToHome and `scheduled_at`.
 */
export function careToHome(input: CareHomeInput): HomeSourceContribution {
  const { track } = input;
  const itemDomain = input.sourceDomain ?? 'care';
  const items: HomeApiItem[] = [];

  if (track.state === 'cancelled' || track.state === 'outcome') {
    return {
      source_domain: 'care',
      data_mode: input.dataMode ?? 'live',
      observed_at: input.observedAt,
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      items,
    };
  }

  if (track.state === 'discover' && !input.needsUserAction) {
    return {
      source_domain: 'care',
      data_mode: input.dataMode ?? 'live',
      observed_at: input.observedAt,
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
      items,
    };
  }

  let kind: HomeApiItem['kind'] = 'status';
  let title = input.title;
  let body = input.detail;
  let delivery: HomeApiItem['delivery'] = 'home';

  switch (track.state) {
    case 'discover':
      kind = 'action';
      title = `${input.title}: revisa el siguiente paso`;
      break;
    case 'prepare':
      kind = 'action';
      title = `${input.title}: falta preparar algo`;
      body = input.detail ?? 'Revisa lo necesario antes de continuar.';
      break;
    case 'act':
      kind = 'action';
      title = `${input.title}: listo para continuar`;
      break;
    case 'wait':
      kind = 'status';
      title = input.title;
      body = waitingDetail(track, input.detail);
      break;
    case 'result':
      kind = 'action';
      delivery = 'home_notify';
      title = `${input.title}: hay un resultado`;
      body = input.detail ?? 'Revisa el resultado y decide el siguiente paso.';
      break;
    case 'follow_up':
      kind = 'action';
      title = `${input.title}: seguimiento pendiente`;
      body = input.detail ?? 'Hay una acción de seguimiento pendiente.';
      break;
  }

  items.push({
    id: `care-home-${track.id}`,
    kind,
    title,
    ...(body ? { body } : {}),
    source_domain: itemDomain,
    delivery,
    care_track_id: track.id,
    related_entity_id: track.id,
    action_label: kind === 'status' ? 'Ver seguimiento' : 'Continuar',
  });

  return {
    source_domain: 'care',
    data_mode: input.dataMode ?? 'live',
    observed_at: input.observedAt,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    items,
  };
}
