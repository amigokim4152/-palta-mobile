export interface LearningNode {
  id: string;
  knowledgeId: string;
  title: string;
  ageRange?: { min?: number; max?: number };
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisiteNodeIds: string[];
  curriculumObjectiveIds: string[];
  learningObjectives: string[];
  misconceptionRefs: string[];
  practiceRefs: string[];
  nextNodeIds: string[];
}

export interface LearnerProgress {
  learnerId: string;
  nodeId: string;
  state: 'not_started' | 'learning' | 'practicing' | 'demonstrated' | 'needs_review';
  updatedAt: string;
}

export function canStartNode(node: LearningNode, demonstratedNodeIds: ReadonlySet<string>): boolean {
  return node.prerequisiteNodeIds.every((id) => demonstratedNodeIds.has(id));
}

export function learningNeedsPrivateStorage(_progress: LearnerProgress): true {
  return true;
}
