import type {
  LifeEventContext,
  LifeEventGuidance,
  LifeEventRisk,
} from './lifeEventModel.js';

export type RiskRule = {
  id: string;
  eventType: string;
  when?: (context: LifeEventContext) => boolean;
  build: (context: LifeEventContext) => LifeEventRisk;
};

function groupByUrgency(
  eventType: string,
  risks: LifeEventRisk[],
): LifeEventGuidance {
  return {
    eventType,
    immediate: risks.filter((risk) => risk.urgency === 'immediate'),
    today: risks.filter((risk) => risk.urgency === 'today'),
    soon: risks.filter((risk) => risk.urgency === 'soon'),
    later: risks.filter((risk) => risk.urgency === 'later'),
  };
}

export function evaluateLifeEvent(
  context: LifeEventContext,
  rules: readonly RiskRule[],
): LifeEventGuidance {
  const risks = rules
    .filter((rule) => rule.eventType === context.eventType)
    .filter((rule) => (rule.when ? rule.when(context) : true))
    .map((rule) => rule.build(context));

  return groupByUrgency(context.eventType, risks);
}
