import type { BusinessVerificationStatus } from '../business/businessActionPolicy.js';
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

export function businessVerificationLabel(
  status: BusinessVerificationStatus,
  locale: PaltaLocale,
): string {
  return VERIFICATION_LABELS[locale][status];
}
