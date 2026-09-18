import type {
  BusinessCapability,
  BusinessVerificationStatus,
} from '../business/businessActionPolicy.js';
import type { PaltaLocale } from './locales.js';

const VERIFICATION_LABELS: Record<
  PaltaLocale,
  Record<BusinessVerificationStatus, string>
> = {
  'es-CL': {
    unverified: 'No verificado',
    claimed: 'Reclamado por el negocio',
    verified: 'Verificado',
    suspended: 'Suspendido',
  },
  ko: {
    unverified: '미인증',
    claimed: '업체 소유권 신청됨',
    verified: '인증됨',
    suspended: '이용 중지',
  },
  en: {
    unverified: 'Unverified',
    claimed: 'Claimed by business',
    verified: 'Verified',
    suspended: 'Suspended',
  },
  'zh-Hans': {
    unverified: '未认证',
    claimed: '商家已认领',
    verified: '已认证',
    suspended: '已暂停',
  },
};

const CAPABILITY_LABELS: Record<
  PaltaLocale,
  Record<BusinessCapability, string>
> = {
  'es-CL': {
    call: 'Llamar',
    whatsapp: 'WhatsApp',
    save: 'Guardar',
    quote: 'Cotizar',
    reservation: 'Reservar',
    queue: 'Tomar turno',
    inquiry: 'Consultar',
    coupon: 'Cupón',
    pricing: 'Precios',
  },
  ko: {
    call: '전화',
    whatsapp: 'WhatsApp',
    save: '저장',
    quote: '견적 요청',
    reservation: '예약',
    queue: '대기 등록',
    inquiry: '문의',
    coupon: '쿠폰',
    pricing: '가격',
  },
  en: {
    call: 'Call',
    whatsapp: 'WhatsApp',
    save: 'Save',
    quote: 'Request quote',
    reservation: 'Reserve',
    queue: 'Join queue',
    inquiry: 'Ask',
    coupon: 'Coupon',
    pricing: 'Pricing',
  },
  'zh-Hans': {
    call: '电话',
    whatsapp: 'WhatsApp',
    save: '保存',
    quote: '询价',
    reservation: '预约',
    queue: '排队',
    inquiry: '咨询',
    coupon: '优惠券',
    pricing: '价格',
  },
};

export function businessVerificationLabel(
  status: BusinessVerificationStatus,
  locale: PaltaLocale,
): string {
  return VERIFICATION_LABELS[locale][status];
}

export function businessCapabilityLabel(
  capability: BusinessCapability,
  locale: PaltaLocale,
): string {
  return CAPABILITY_LABELS[locale][capability];
}
