/**
 * BackSeat design tokens.
 * Derived from _design/v1/.../backseat_safety_system/DESIGN.md (Material 3).
 * Color encodes escalation state:
 *   teal   = Safe / Resolved (anchor)
 *   blue   = Monitoring / active drive
 *   amber  = First reminder
 *   red    = Loud alarm / expired timer (full-screen takeover only)
 */

export const colors = {
  // Surfaces & neutrals
  surface: '#f8f9ff',
  surfaceDim: '#d0dbed',
  surfaceBright: '#f8f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eff4ff',
  surfaceContainer: '#e6eeff',
  surfaceContainerHigh: '#dee9fc',
  surfaceContainerHighest: '#d9e3f6',
  surfaceVariant: '#d9e3f6',
  onSurface: '#121c2a',
  onSurfaceVariant: '#3d4949',
  inverseSurface: '#27313f',
  inverseOnSurface: '#eaf1ff',
  outline: '#6d7979',
  outlineVariant: '#bcc9c8',
  background: '#f8f9ff',
  onBackground: '#121c2a',

  // Primary (teal) — Safe / Resolved
  primary: '#006767',
  onPrimary: '#ffffff',
  primaryContainer: '#008282',
  onPrimaryContainer: '#f3fffe',

  // Secondary (blue) — Monitoring / active session
  secondary: '#1960a3',
  onSecondary: '#ffffff',
  secondaryContainer: '#7db6ff',
  onSecondaryContainer: '#00477f',
  secondaryFixed: '#d3e4ff',
  onSecondaryFixed: '#001c38',

  // Tertiary (amber) — First reminder
  tertiary: '#8d4b00',
  onTertiary: '#ffffff',
  tertiaryContainer: '#b15f00',
  onTertiaryContainer: '#fffbff',
  tertiaryFixed: '#ffdcc3',
  onTertiaryFixed: '#2f1500',

  // Error (red) — Loud alarm / expired timer
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
} as const;

export type ColorToken = keyof typeof colors;

/** 8px baseline grid. */
export const spacing = {
  base: 8,
  stackSm: 12,
  gutter: 16,
  stackMd: 24,
  marginMobile: 20,
  marginDesktop: 40,
  stackLg: 48,
  touchTargetMin: 48,
  primaryButtonHeight: 56,
} as const;

/** Corner radii. Buttons/inputs 8px, cards/modals 16px, dots/pills full. */
export const radius = {
  sm: 4,
  button: 8,
  md: 12,
  card: 16,
  xl: 24,
  full: 9999,
} as const;

type TypeStyle = {
  fontFamily: 'Inter';
  fontSize: number;
  fontWeight: '400' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/** Inter type scale. letterSpacing converted from em to absolute px (em * fontSize). */
export const type = {
  displayLg: {
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: -0.96,
  },
  headlineLg: {
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.32,
  },
  headlineLgMobile: {
    fontFamily: 'Inter',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  titleMd: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  labelMd: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.7,
  },
  statusNumber: {
    fontFamily: 'Inter',
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 64,
    letterSpacing: -2.56,
  },
} as const satisfies Record<string, TypeStyle>;

export type TypeToken = keyof typeof type;
