export type ReadingMode =
  | 'standard'
  | 'focus'
  | 'listen';

export type ReadingBlock =
  | { kind: 'heading'; text: string; locale?: string }
  | { kind: 'paragraph'; text: string; locale?: string }
  | { kind: 'quote'; text: string; locale?: string }
  | { kind: 'list_item'; text: string; locale?: string }
  | { kind: 'table_summary'; text: string; locale?: string }
  | { kind: 'source'; text: string; locale?: string };

export type ReadingProgress = {
  contentId: string;
  blockIndex: number;
  characterOffset: number;
  mode: ReadingMode;
};

export function speechSequence(
  blocks: readonly ReadingBlock[],
): ReadingBlock[] {
  // Source can be read at the end; UI controls/metadata never enter this model.
  return blocks.filter((block) => block.text.trim().length > 0);
}

export function clampReadingProgress(
  progress: ReadingProgress,
  blockCount: number,
): ReadingProgress {
  return {
    ...progress,
    blockIndex: Math.max(0, Math.min(progress.blockIndex, Math.max(0, blockCount - 1))),
    characterOffset: Math.max(0, progress.characterOffset),
  };
}
