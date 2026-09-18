import type { CurriculumObjectiveRef } from './curriculumRegistry.js';
import type { LearningNode } from './learningGraph.js';

export interface CurriculumKnowledgeLink {
  curriculumObjectiveId: string;
  knowledgeId: string;
  relationship: 'teaches' | 'practices' | 'assesses';
}

export function objectiveKnowledgeLinks(objective: CurriculumObjectiveRef): CurriculumKnowledgeLink[] {
  return objective.conceptRefs.map((knowledgeId) => ({
    curriculumObjectiveId: objective.id,
    knowledgeId,
    relationship: 'teaches',
  }));
}

export function learningNodeFromObjective(
  objective: CurriculumObjectiveRef,
  knowledgeId: string,
  title: string,
  prerequisiteNodeIds: string[] = [],
): LearningNode {
  if (!objective.conceptRefs.includes(knowledgeId)) {
    throw new Error(`Knowledge ${knowledgeId} is not linked to curriculum objective ${objective.id}.`);
  }

  return {
    id: `LEARN:${objective.id}:${knowledgeId}`,
    knowledgeId,
    title,
    difficulty: 1,
    prerequisiteNodeIds,
    curriculumObjectiveIds: [objective.id],
    learningObjectives: [],
    misconceptionRefs: [],
    practiceRefs: [],
    nextNodeIds: [],
  };
}
