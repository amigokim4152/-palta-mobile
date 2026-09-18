/**
 * Palta UI v1 candidate tokens.
 *
 * Brand-facing color values are derived from the current official Palta symbol.
 * They are implementation candidates, not a replacement for the Brand Master.
 * UI code should consume semantic roles only.
 */
export const paltaTheme = {
  color: {
    canvas: '#F7F8F4',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F3ED',
    textPrimary: '#18201B',
    textSecondary: '#667069',
    textMuted: '#858D87',
    divider: '#E5E8E2',
    border: '#D8DDD5',
    brandPrimary: '#0C5E27',
    brandMid: '#399320',
    brandFresh: '#6BBA15',
    brandSoft: '#EAF4E6',
    avocadoCream: '#FDF4B4',
    danger: '#A02A2A',
    warning: '#8A5A00',
    info: '#315A86',
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    control: 12,
    surface: 16,
    prominent: 18,
    sheet: 24,
    pill: 999,
  },
  touch: {
    minimum: 48,
  },
} as const;
