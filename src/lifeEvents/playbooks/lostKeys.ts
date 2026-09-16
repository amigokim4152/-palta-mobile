import type { RiskRule } from '../exposureEngine.js';

export const lostKeysRules: readonly RiskRule[] = [
  {
    id: 'address_link_check',
    eventType: 'keys_lost',
    build: () => ({
      id: 'address_link_check',
      title: '열쇠와 주소가 연결될 수 있는지 확인',
      rationale:
        '열쇠만 잃은 경우와 주소를 알 수 있는 신분증·우편물·가방을 함께 잃은 경우의 위험은 다릅니다.',
      evidence: 'common_risk_prompt',
      urgency: 'immediate',
      actionability: 'user_must_confirm',
      relatedDomains: ['home', 'identity', 'security'],
      confirmQuestion:
        '주소를 알 수 있는 신분증·서류·가방을 열쇠와 함께 잃어버렸나요?',
      suggestedAction: '함께 분실한 물품 확인',
    }),
  },
  {
    id: 'access_token_check',
    eventType: 'keys_lost',
    build: () => ({
      id: 'access_token_check',
      title: '전자 출입수단도 함께 확인',
      rationale:
        '공동현관 태그, 차고 리모컨, 스마트락 권한 등이 함께 없어졌다면 물리적 열쇠와 별도로 비활성화가 필요할 수 있습니다.',
      evidence: 'common_risk_prompt',
      urgency: 'today',
      actionability: 'user_must_confirm',
      relatedDomains: ['home', 'access', 'security'],
      confirmQuestion:
        '공동현관 태그·차고 리모컨·스마트키도 함께 잃어버렸나요?',
      suggestedAction: '출입수단 확인',
    }),
  },
] as const;
