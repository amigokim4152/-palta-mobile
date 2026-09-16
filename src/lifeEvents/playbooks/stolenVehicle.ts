import type { RiskRule } from '../exposureEngine.js';

export const stolenVehicleRules: readonly RiskRule[] = [
  {
    id: 'vehicle_report',
    eventType: 'vehicle_stolen',
    build: () => ({
      id: 'vehicle_report',
      title: '차량 도난 신고',
      rationale:
        '차량 자체의 회수·보험·공식 기록을 위해 우선 처리해야 하는 핵심 단계입니다.',
      evidence: 'common_risk_prompt',
      urgency: 'immediate',
      actionability: 'palta_can_connect',
      relatedDomains: ['vehicle', 'police', 'insurance'],
      suggestedAction: '신고 절차 보기',
    }),
  },
  {
    id: 'home_access_exposure',
    eventType: 'vehicle_stolen',
    build: (context) => {
      const known =
        context.knownFacts.hasHomeAccessRemoteInVehicle === true ||
        context.confirmedFacts.hasHomeAccessRemoteInVehicle === true;

      return {
        id: 'home_access_exposure',
        title: '집 출입수단 노출 가능성',
        rationale:
          '차 안에 차고 리모컨, 공동출입 리모컨, 집 열쇠 등이 있었다면 주거 접근 위험이 생길 수 있습니다.',
        evidence: known ? 'user_confirmed' : 'common_risk_prompt',
        urgency: 'immediate',
        actionability: known ? 'user_must_do' : 'user_must_confirm',
        relatedDomains: ['home', 'access', 'security'],
        ...(!known
          ? {
              confirmQuestion:
                '차 안에 집 열쇠나 건물·차고 출입 리모컨이 있었나요?',
            }
          : {}),
        suggestedAction: known
          ? '관리실·출입시스템에서 비활성화 여부 확인'
          : '차 안 물품 확인',
      };
    },
  },
  {
    id: 'address_exposure',
    eventType: 'vehicle_stolen',
    build: () => ({
      id: 'address_exposure',
      title: '주소 노출 가능성 확인',
      rationale:
        '차량 서류나 개인 문서에 거주 주소가 포함되어 있다면 다른 노출과 결합될 수 있습니다.',
      evidence: 'common_risk_prompt',
      urgency: 'today',
      actionability: 'user_must_confirm',
      relatedDomains: ['identity', 'home', 'documents'],
      confirmQuestion:
        '차 안에 주소가 표시된 차량서류·신분증·우편물 같은 문서가 있었나요?',
      suggestedAction: '노출된 문서 확인',
    }),
  },
  {
    id: 'wallet_phone_exposure',
    eventType: 'vehicle_stolen',
    build: () => ({
      id: 'wallet_phone_exposure',
      title: '다른 중요 물품도 함께 있었는지 확인',
      rationale:
        '휴대전화·지갑·회사 출입카드 등이 함께 분실되었다면 계정·금융·출입 보안 대응이 추가로 필요합니다.',
      evidence: 'common_risk_prompt',
      urgency: 'immediate',
      actionability: 'user_must_confirm',
      relatedDomains: ['phone', 'wallet', 'identity', 'work_access'],
      confirmQuestion:
        '차 안에 휴대전화, 지갑, 신분증, 회사 출입카드 같은 중요 물품이 있었나요?',
      suggestedAction: '함께 없어진 물품 확인',
    }),
  },
  {
    id: 'insurance_followup',
    eventType: 'vehicle_stolen',
    build: () => ({
      id: 'insurance_followup',
      title: '보험 후속 처리',
      rationale:
        '보험 가입 여부와 보장조건에 따라 신고번호, 서류 제출, 조사 등의 후속 절차가 생길 수 있습니다.',
      evidence: 'common_risk_prompt',
      urgency: 'today',
      actionability: 'palta_can_connect',
      relatedDomains: ['insurance', 'vehicle'],
      suggestedAction: '보험 절차 확인',
    }),
  },
] as const;
