import type {
  Actionability,
  LifeEventRisk,
} from './lifeEventModel.js';

export type ActionBridge =
  | {
      kind: 'direct';
      label: string;
      actionKey: string;
    }
  | {
      kind: 'contact';
      label: string;
      contactType: 'phone' | 'web' | 'message' | 'in_person';
      target?: string;
    }
  | {
      kind: 'checklist';
      label: string;
    }
  | {
      kind: 'information';
      label: string;
    };

export function bridgeForRisk(risk: LifeEventRisk): ActionBridge {
  switch (risk.actionability as Actionability) {
    case 'palta_can_do':
      return {
        kind: 'direct',
        label: risk.suggestedAction ?? '처리하기',
        actionKey: risk.id,
      };
    case 'palta_can_connect':
      return {
        kind: 'contact',
        label: risk.suggestedAction ?? '연결하기',
        contactType: 'web',
      };
    case 'user_must_confirm':
    case 'user_must_do':
      return {
        kind: 'checklist',
        label: risk.suggestedAction ?? '확인하기',
      };
    case 'inform_only':
      return {
        kind: 'information',
        label: '알아두기',
      };
  }
}
