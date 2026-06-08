/**
 * RealMVP color tokens — light, clean, travel-app style: warm off-white canvas, crisp
 * white cards with soft shadows, a signature lime highlight, and a friendly blue accent.
 * Never hardcode a color in a component; always reference a token here.
 *
 * NOTE: the accent token names (`violet`, `magenta`, `cyan`) are kept for stability across
 * the codebase but now hold the light-theme accent set (blue / coral / teal).
 */

export const palette = {
  // Canvas / surfaces (light)
  black: '#0E0F13',
  bg: '#EFEFE9', // warm light-grey canvas
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F6F0',
  surfaceHover: '#ECECE4',
  border: '#E4E4DB',
  borderSoft: '#EFEFE8',

  // Text (dark on light)
  textPrimary: '#15161C',
  textSecondary: '#5A5E68',
  textMuted: '#9CA0A8',
  textInverse: '#15161C', // text that sits on a lime fill is dark

  // Signature accents
  lime: '#C9F24B', // primary highlight + CTA fill (dark text on top)
  limeDeep: '#B2E22C',
  violet: '#2E7DF6', // primary blue accent (icons, active, focus, links)
  violetDeep: '#1F66D8',
  magenta: '#FF6B6B', // coral secondary (badges, alerts)
  cyan: '#16C5B0', // teal tertiary
  amber: '#FF9F43',

  // Semantic
  success: '#27C28B',
  warning: '#FF9F43',
  danger: '#F0556B',
  info: '#2E7DF6',

  // Subtle fills / strokes for cards on light bg
  glassFill: 'rgba(20,22,28,0.015)',
  glassStroke: 'rgba(20,22,28,0.06)',
  scrim: 'rgba(244,244,240,0.6)',
} as const;

/** Gradient stop sets used by GradientButton, BentoCard, AnimatedBackground. */
export const gradients = {
  primary: ['#D2F85B', '#B2E22C'] as const, // lime CTA (use dark text)
  aurora: ['#D8F86A', '#7FD8FF'] as const, // lime → sky blue (hero / decorative)
  cyanViolet: ['#7FD8FF', '#2E7DF6'] as const,
  ember: ['#FFC36B', '#FF6B6B'] as const,
  surface: ['#FFFFFF', '#F6F6F0'] as const, // subtle card sheen
  success: ['#5FE0A8', '#16C5B0'] as const,
} as const;

export type GradientName = keyof typeof gradients;

export const colors = palette;
