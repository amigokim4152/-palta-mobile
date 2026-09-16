export type ResultSheetSnap = 'peek' | 'half' | 'full';

export type ResultSheetContext = {
  resultCount: number;
  selectedEntityId: string | null;
  keyboardOpen: boolean;
};

export function preferredResultSheetSnap(
  context: ResultSheetContext,
): ResultSheetSnap {
  if (context.keyboardOpen) return 'full';
  if (context.selectedEntityId) return 'half';
  if (context.resultCount === 0) return 'peek';
  if (context.resultCount <= 2) return 'peek';
  return 'half';
}

export function nextSheetSnap(
  current: ResultSheetSnap,
  direction: 'up' | 'down',
): ResultSheetSnap {
  const snaps: ResultSheetSnap[] = ['peek', 'half', 'full'];
  const index = snaps.indexOf(current);

  if (direction === 'up') {
    return snaps[Math.min(index + 1, snaps.length - 1)]!;
  }
  return snaps[Math.max(index - 1, 0)]!;
}
