export type TextScaleClass =
  | 'normal'
  | 'large'
  | 'accessibility';

export type FocusLayoutPolicy = {
  columns: 1 | 2;
  maxInitialGlanceItems: number;
  maxInitialSecondaryItems: number;
  preferTextLabelsOverIconOnly: boolean;
  stackPrimaryActions: boolean;
  preferFullHeightSheet: boolean;
  allowHorizontalMetadataCompression: boolean;
};

export function classifyTextScale(fontScale: number): TextScaleClass {
  if (!Number.isFinite(fontScale) || fontScale <= 1.15) return 'normal';
  if (fontScale <= 1.55) return 'large';
  return 'accessibility';
}

export function focusLayoutPolicy(
  fontScale: number,
): FocusLayoutPolicy {
  const level = classifyTextScale(fontScale);

  if (level === 'normal') {
    return {
      columns: 2,
      maxInitialGlanceItems: 4,
      maxInitialSecondaryItems: 3,
      preferTextLabelsOverIconOnly: false,
      stackPrimaryActions: false,
      preferFullHeightSheet: false,
      allowHorizontalMetadataCompression: true,
    };
  }

  if (level === 'large') {
    return {
      columns: 1,
      maxInitialGlanceItems: 3,
      maxInitialSecondaryItems: 2,
      preferTextLabelsOverIconOnly: true,
      stackPrimaryActions: true,
      preferFullHeightSheet: false,
      allowHorizontalMetadataCompression: false,
    };
  }

  return {
    columns: 1,
    maxInitialGlanceItems: 2,
    maxInitialSecondaryItems: 1,
    preferTextLabelsOverIconOnly: true,
    stackPrimaryActions: true,
    preferFullHeightSheet: true,
    allowHorizontalMetadataCompression: false,
  };
}
