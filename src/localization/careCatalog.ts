import type { PaltaLocale } from './locales.js';

export const CARE_ES = {
  'care.title': 'Seguimiento',
  'care.loading': 'Cargando seguimiento…',
  'care.noData': 'No hay datos disponibles.',
  'care.eyebrow': 'SEGUIMIENTO',
  'care.state': 'Estado: {state}',
  'care.subtitle': 'Palta conserva el proceso hasta resultado y seguimiento.',
  'care.waitingFor': 'Esperando: {value}',
  'care.estimatedAt': 'Fecha estimada: {value}',
  'care.id': 'Care ID: {id}',
  'care.refresh': 'Actualizar estado',
  'care.backHome': 'Volver a Inicio',
  'care.timeline.done': 'Completado',
  'care.timeline.current': 'Actual',
  'care.timeline.upcoming': 'Próximo',
} as const;

export type CareCopyKey = keyof typeof CARE_ES;
export type CareInterpolation = Record<string, string | number>;
type CareCatalog = Partial<Record<CareCopyKey, string>>;

const KO: CareCatalog = {
  'care.title': '진행 상황',
  'care.loading': '진행 상황을 불러오고 있습니다…',
  'care.noData': '표시할 진행 정보가 없습니다.',
  'care.eyebrow': '진행 상황',
  'care.state': '현재 상태: {state}',
  'care.subtitle': 'Palta는 결과와 후속조치가 끝날 때까지 이 과정을 이어서 관리합니다.',
  'care.waitingFor': '기다리는 항목: {value}',
  'care.estimatedAt': '예상 시점: {value}',
  'care.id': 'Care ID: {id}',
  'care.refresh': '상태 새로고침',
  'care.backHome': '홈으로 돌아가기',
  'care.timeline.done': '완료됨',
  'care.timeline.current': '현재 단계',
  'care.timeline.upcoming': '다음 단계',
};

const EN: CareCatalog = {
  'care.title': 'Progress',
  'care.loading': 'Loading progress…',
  'care.noData': 'No progress data is available.',
  'care.eyebrow': 'PROGRESS',
  'care.state': 'Status: {state}',
  'care.subtitle': 'Palta keeps the process together through the result and follow-up.',
  'care.waitingFor': 'Waiting for: {value}',
  'care.estimatedAt': 'Estimated time: {value}',
  'care.id': 'Care ID: {id}',
  'care.refresh': 'Refresh status',
  'care.backHome': 'Back to Home',
  'care.timeline.done': 'Completed',
  'care.timeline.current': 'Current',
  'care.timeline.upcoming': 'Upcoming',
};

const ZH_HANS: CareCatalog = {
  'care.title': '进度',
  'care.loading': '正在加载进度…',
  'care.noData': '暂无可显示的进度信息。',
  'care.eyebrow': '进度',
  'care.state': '当前状态：{state}',
  'care.subtitle': 'Palta 会持续管理整个流程，直到结果和后续处理完成。',
  'care.waitingFor': '正在等待：{value}',
  'care.estimatedAt': '预计时间：{value}',
  'care.id': 'Care ID：{id}',
  'care.refresh': '刷新状态',
  'care.backHome': '返回首页',
  'care.timeline.done': '已完成',
  'care.timeline.current': '当前阶段',
  'care.timeline.upcoming': '下一阶段',
};

const CATALOGS: Record<PaltaLocale, CareCatalog> = {
  'es-CL': CARE_ES,
  ko: KO,
  en: EN,
  'zh-Hans': ZH_HANS,
};

function interpolate(template: string, values?: CareInterpolation): string {
  if (!values) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function careT(
  key: CareCopyKey,
  locale: PaltaLocale,
  values?: CareInterpolation,
): string {
  const translated = CATALOGS[locale][key];
  return interpolate(translated?.trim() ? translated : CARE_ES[key], values);
}
