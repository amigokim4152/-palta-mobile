export type CareState =
  | 'discover'
  | 'prepare'
  | 'act'
  | 'wait'
  | 'result'
  | 'follow_up'
  | 'outcome'
  | 'cancelled';

export type CareTimelineStep = {
  state: Exclude<CareState, 'cancelled'>;
  status: 'done' | 'current' | 'upcoming';
};

const orderedStates: Array<Exclude<CareState, 'cancelled'>> = [
  'discover',
  'prepare',
  'act',
  'wait',
  'result',
  'follow_up',
  'outcome',
];

export function buildCareTimeline(
  currentState: CareState,
): CareTimelineStep[] {
  if (currentState === 'cancelled') {
    return [];
  }

  const currentIndex = orderedStates.indexOf(currentState);

  return orderedStates.map((state, index) => ({
    state,
    status:
      index < currentIndex
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'upcoming',
  }));
}

export function careStateLabel(
  state: CareState,
  locale: 'es-CL' | 'ko-KR' = 'es-CL',
): string {
  const labels = {
    'es-CL': {
      discover: 'Encontrar',
      prepare: 'Preparar',
      act: 'Hacer',
      wait: 'Esperando',
      result: 'Resultado',
      follow_up: 'Seguimiento',
      outcome: 'Cerrado',
      cancelled: 'Cancelado',
    },
    'ko-KR': {
      discover: '찾기',
      prepare: '준비',
      act: '실행',
      wait: '기다리는 중',
      result: '결과',
      follow_up: '후속조치',
      outcome: '완료',
      cancelled: '취소',
    },
  } as const;

  return labels[locale][state];
}
