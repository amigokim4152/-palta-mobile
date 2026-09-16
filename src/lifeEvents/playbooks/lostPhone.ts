import type { RiskRule } from '../exposureEngine.js';

export const lostPhoneRules: readonly RiskRule[] = [
  {
    id: 'palta_session_revoke',
    eventType: 'phone_lost',
    build: () => ({
      id: 'palta_session_revoke',
      title: 'Palta 세션 보호',
      rationale:
        '분실 기기에 남아 있는 Palta 인증 세션을 종료해 개인 정보 접근 위험을 줄일 수 있습니다.',
      evidence: 'known_from_profile',
      urgency: 'immediate',
      actionability: 'palta_can_do',
      relatedDomains: ['identity', 'palta_account'],
      suggestedAction: '분실 기기 세션 종료',
    }),
  },
  {
    id: 'sim_account_exposure',
    eventType: 'phone_lost',
    build: () => ({
      id: 'sim_account_exposure',
      title: 'SIM·인증계정 보호',
      rationale:
        '분실 휴대전화가 문자 인증이나 계정 복구 수단으로 사용되었다면 다른 계정에도 연쇄 위험이 생길 수 있습니다.',
      evidence: 'common_risk_prompt',
      urgency: 'immediate',
      actionability: 'palta_can_connect',
      relatedDomains: ['telco', 'identity', 'banking'],
      suggestedAction: '통신사 차단 절차 확인',
    }),
  },
  {
    id: 'financial_apps_check',
    eventType: 'phone_lost',
    build: () => ({
      id: 'financial_apps_check',
      title: '금융·결제 앱 점검',
      rationale:
        '잠금상태와 인증설정에 따라 은행·결제 앱 보호 조치가 추가로 필요할 수 있습니다.',
      evidence: 'common_risk_prompt',
      urgency: 'today',
      actionability: 'user_must_do',
      relatedDomains: ['banking', 'payment'],
      suggestedAction: '중요 금융앱 확인',
    }),
  },
] as const;
