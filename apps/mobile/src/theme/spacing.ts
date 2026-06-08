/** Spacing, radius, and shadow tokens. 4px base scale. */

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  /** Soft, diffuse shadow under white cards on a light canvas. */
  card: {
    shadowColor: '#1B1C22',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  /** Subtle lift on primary CTAs / active states (lime tint). */
  glow: {
    shadowColor: '#A7D62E',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
