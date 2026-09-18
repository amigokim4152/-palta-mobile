import type { PaltaLocale } from '../localization/locales.js';

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

const labels: Record<PaltaLocale, Record<CareState, string>> = {
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
  ko: {
    discover: '찾기',
    prepare: '준비',
    act: '실행',
    wait: '기다리는 중',
    result: '결과',
    follow_up: '후속조치',
    outcome: '완료',
    cancelled: '취소',
  },
  en: {
    discover: 'Find',
    prepare: 'Prepare',
    act: 'Act',
    wait: 'Waiting',
    result: 'Result',
    follow_up: 'Follow-up',
    outcome: 'Closed',
    cancelled: 'Cancelled',
  },
  'zh-Hans': {
    discover: '查找',
    prepare: '准备',
    act: '执行',
    wait: '等待中',
    result: '结果',
    follow_up: '后续处理',
    outcome: '已完成',
    cancelled: '已取消',
  },
};

type CareLocaleInput = PaltaLocale | 'ko-KR';

export function careStateLabel(
  state: CareState,
  locale: CareLocaleInput = 'es-CL',
): string {
  const normalizedLocale: PaltaLocale = locale === 'ko-KR' ? 'ko' : locale;
  return labels[normalizedLocale][state];
}
