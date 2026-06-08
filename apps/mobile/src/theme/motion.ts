import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens — the ctrl.xyz feel is smooth, springy, confident. Use these
 * durations/easings everywhere so animation feels consistent across the app.
 */
export const motion = {
  duration: {
    fast: 160,
    base: 260,
    slow: 420,
    xslow: 680,
  },
  easing: {
    // Standard ease for entrances / opacity.
    standard: Easing.bezier(0.22, 1, 0.36, 1),
    // Snappy ease for exits.
    accelerate: Easing.bezier(0.4, 0, 1, 1),
    // Gentle in-out for ambient / looping motion.
    inOut: Easing.inOut(Easing.cubic),
  },
  spring: {
    /** Press feedback / chips. */
    snappy: { damping: 18, stiffness: 260, mass: 0.7 },
    /** Card entrance / sheet. */
    soft: { damping: 20, stiffness: 140, mass: 0.9 },
    /** Bouncy success / hero. */
    bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
  },
  /** Staggered list entrance: delay per index (ms). */
  stagger: 60,
} as const;
